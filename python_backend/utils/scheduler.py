"""
Celery Task Scheduler for Automated Scraping and Analysis
"""
import asyncio
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Dict

from celery import Celery
from celery.schedules import crontab
from loguru import logger

from python_backend.config.config import settings
from python_backend.database.db import get_db_context
from python_backend.models.models import (
    Watch, Brand, ScrapingJob, PriceAlert,
    MarketplaceListing, PriceHistory
)
from python_backend.scrapers.chrono24_scraper import Chrono24Scraper
from python_backend.scrapers.ebay_scraper import EbayScraper
from python_backend.analytics.price_analyzer import PriceAnalyzer
from python_backend.utils.notifications import NotificationManager

# Initialize Celery
celery_app = Celery('watch_pricing_tasks', broker=settings.REDIS_URL)

# Celery configuration
celery_app.conf.update(
    result_backend=settings.REDIS_URL,
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
)

# Periodic task schedule
celery_app.conf.beat_schedule = {
    'scrape-chrono24-every-6-hours': {
        'task': 'python_backend.utils.scheduler.scrape_chrono24_task',
        'schedule': crontab(minute=0, hour='*/6'),  # Every 6 hours
    },
    'scrape-ebay-every-6-hours': {
        'task': 'python_backend.utils.scheduler.scrape_ebay_task',
        'schedule': crontab(minute=30, hour='*/6'),  # Every 6 hours, offset by 30 min
    },
    'analyze-prices-hourly': {
        'task': 'python_backend.utils.scheduler.analyze_prices_task',
        'schedule': crontab(minute=0),  # Every hour
    },
    'check-alerts-every-15-minutes': {
        'task': 'python_backend.utils.scheduler.check_price_alerts_task',
        'schedule': crontab(minute='*/15'),  # Every 15 minutes
    },
    'find-opportunities-daily': {
        'task': 'python_backend.utils.scheduler.find_opportunities_task',
        'schedule': crontab(hour=8, minute=0),  # Daily at 8 AM UTC
    },
    'cleanup-old-data-weekly': {
        'task': 'python_backend.utils.scheduler.cleanup_old_data_task',
        'schedule': crontab(hour=2, minute=0, day_of_week=0),  # Sunday at 2 AM
    },
}


@celery_app.task(name='python_backend.utils.scheduler.scrape_chrono24_task')
def scrape_chrono24_task():
    """
    Scrape Chrono24 for all tracked watches
    """
    logger.info("Starting Chrono24 scraping task")

    with get_db_context() as db:
        # Create scraping job record
        job = ScrapingJob(
            job_type='chrono24',
            status='running',
            started_at=datetime.utcnow()
        )
        db.add(job)
        db.commit()

        try:
            # Get watches to scrape
            watches = db.query(Watch).join(Brand).limit(100).all()

            logger.info(f"Scraping {len(watches)} watches from Chrono24")

            scraper = Chrono24Scraper()
            total_listings = 0
            new_listings = 0
            updated_listings = 0

            for watch in watches:
                try:
                    # Scrape watch
                    listings = asyncio.run(scraper.scrape_watch(
                        reference_number=watch.reference_number,
                        brand=watch.brand.name if watch.brand else None,
                        filters={'min_seller_score': 0.7}
                    ))

                    total_listings += len(listings)

                    # Save listings
                    for listing_data in listings:
                        result = save_listing(db, watch, listing_data)
                        if result == 'new':
                            new_listings += 1
                        elif result == 'updated':
                            updated_listings += 1

                    # Small delay between watches
                    asyncio.run(asyncio.sleep(2))

                except Exception as e:
                    logger.error(f"Error scraping watch {watch.id}: {e}")
                    continue

            # Update job record
            job.status = 'completed'
            job.completed_at = datetime.utcnow()
            job.listings_found = total_listings
            job.listings_new = new_listings
            job.listings_updated = updated_listings
            job.duration_seconds = (job.completed_at - job.started_at).seconds

            db.commit()

            logger.info(
                f"Chrono24 scraping completed: {total_listings} found, "
                f"{new_listings} new, {updated_listings} updated"
            )

        except Exception as e:
            logger.error(f"Chrono24 scraping task failed: {e}")
            job.status = 'failed'
            job.errors = [str(e)]
            db.commit()


@celery_app.task(name='python_backend.utils.scheduler.scrape_ebay_task')
def scrape_ebay_task():
    """
    Scrape eBay for all tracked watches
    """
    logger.info("Starting eBay scraping task")

    with get_db_context() as db:
        # Create scraping job record
        job = ScrapingJob(
            job_type='ebay',
            status='running',
            started_at=datetime.utcnow()
        )
        db.add(job)
        db.commit()

        try:
            # Get watches to scrape
            watches = db.query(Watch).join(Brand).limit(100).all()

            logger.info(f"Scraping {len(watches)} watches from eBay")

            scraper = EbayScraper()
            total_listings = 0
            new_listings = 0
            updated_listings = 0

            for watch in watches:
                try:
                    # Scrape watch
                    listings = asyncio.run(scraper.scrape_watch(
                        reference_number=watch.reference_number,
                        brand=watch.brand.name if watch.brand else None,
                        filters={'min_seller_score': 0.7}
                    ))

                    total_listings += len(listings)

                    # Save listings
                    for listing_data in listings:
                        result = save_listing(db, watch, listing_data)
                        if result == 'new':
                            new_listings += 1
                        elif result == 'updated':
                            updated_listings += 1

                    # Delay between watches
                    asyncio.run(asyncio.sleep(3))

                except Exception as e:
                    logger.error(f"Error scraping watch {watch.id}: {e}")
                    continue

            # Update job record
            job.status = 'completed'
            job.completed_at = datetime.utcnow()
            job.listings_found = total_listings
            job.listings_new = new_listings
            job.listings_updated = updated_listings
            job.duration_seconds = (job.completed_at - job.started_at).seconds

            db.commit()

            logger.info(
                f"eBay scraping completed: {total_listings} found, "
                f"{new_listings} new, {updated_listings} updated"
            )

        except Exception as e:
            logger.error(f"eBay scraping task failed: {e}")
            job.status = 'failed'
            job.errors = [str(e)]
            db.commit()


@celery_app.task(name='python_backend.utils.scheduler.analyze_prices_task')
def analyze_prices_task():
    """
    Analyze prices for all watches and update price calculations
    """
    logger.info("Starting price analysis task")

    with get_db_context() as db:
        analyzer = PriceAnalyzer(db)

        # Get watches with recent price data
        watches = db.query(Watch).join(PriceHistory).distinct().limit(200).all()

        logger.info(f"Analyzing prices for {len(watches)} watches")

        analyzed_count = 0
        for watch in watches:
            try:
                # Analyze watch pricing
                analysis = analyzer.analyze_watch_pricing(
                    watch_id=watch.id,
                    days_back=30
                )

                analyzed_count += 1

                if analyzed_count % 50 == 0:
                    logger.info(f"Analyzed {analyzed_count} watches")

            except Exception as e:
                logger.error(f"Error analyzing watch {watch.id}: {e}")
                continue

        logger.info(f"Price analysis completed for {analyzed_count} watches")


@celery_app.task(name='python_backend.utils.scheduler.check_price_alerts_task')
def check_price_alerts_task():
    """
    Check all active price alerts and send notifications
    """
    logger.info("Checking price alerts")

    with get_db_context() as db:
        # Get active alerts
        alerts = db.query(PriceAlert).filter(PriceAlert.is_active == True).all()

        notifier = NotificationManager()
        triggered_count = 0

        for alert in alerts:
            try:
                # Check if alert should trigger
                should_trigger = check_alert_condition(db, alert)

                if should_trigger:
                    # Get listing data
                    listing = get_triggering_listing(db, alert)

                    if listing:
                        # Send notification
                        watch_info = {
                            'brand': listing.watch.brand.name if listing.watch.brand else None,
                            'reference_number': listing.watch.reference_number if listing.watch else None,
                        }

                        price_data = {
                            'current_price': float(listing.price_usd),
                            'threshold': float(alert.threshold_amount) if alert.threshold_amount else None,
                            'listing_url': listing.listing_url,
                        }

                        channels = alert.notification_channels or ['email']
                        notifier.send_alert(watch_info, alert.alert_type, price_data, channels)

                        # Update alert
                        alert.last_triggered = datetime.utcnow()
                        db.commit()

                        triggered_count += 1

            except Exception as e:
                logger.error(f"Error checking alert {alert.id}: {e}")
                continue

        logger.info(f"Checked {len(alerts)} alerts, triggered {triggered_count}")


@celery_app.task(name='python_backend.utils.scheduler.find_opportunities_task')
def find_opportunities_task():
    """
    Find buying opportunities and send daily digest
    """
    logger.info("Finding buying opportunities")

    with get_db_context() as db:
        analyzer = PriceAnalyzer(db)

        # Find opportunities
        opportunities = analyzer.find_buying_opportunities(max_results=50)

        logger.info(f"Found {len(opportunities)} opportunities")

        if opportunities:
            # Send notification
            notifier = NotificationManager()
            notifier.send_opportunity_summary(opportunities, channels=['slack', 'email'])

            logger.info("Opportunity digest sent")


@celery_app.task(name='python_backend.utils.scheduler.cleanup_old_data_task')
def cleanup_old_data_task():
    """
    Clean up old data to maintain database performance
    """
    logger.info("Starting data cleanup task")

    with get_db_context() as db:
        # Delete old price history
        history_cutoff = datetime.utcnow() - timedelta(
            days=settings.PRICE_HISTORY_RETENTION_DAYS
        )

        deleted_history = db.query(PriceHistory).filter(
            PriceHistory.recorded_at < history_cutoff
        ).delete()

        # Delete old scraping jobs
        jobs_cutoff = datetime.utcnow() - timedelta(
            days=settings.SCRAPING_JOBS_RETENTION_DAYS
        )

        deleted_jobs = db.query(ScrapingJob).filter(
            ScrapingJob.created_at < jobs_cutoff
        ).delete()

        # Mark old listings as inactive
        listing_cutoff = datetime.utcnow() - timedelta(days=14)

        updated_listings = db.query(MarketplaceListing).filter(
            MarketplaceListing.last_seen < listing_cutoff,
            MarketplaceListing.is_active == True
        ).update({'is_active': False})

        db.commit()

        logger.info(
            f"Cleanup completed: {deleted_history} history records, "
            f"{deleted_jobs} jobs, {updated_listings} listings marked inactive"
        )


# Helper functions

def save_listing(db, watch: Watch, listing_data: Dict) -> str:
    """
    Save or update a marketplace listing

    Returns:
        'new', 'updated', or 'unchanged'
    """
    # Get or create seller
    from python_backend.models.models import Seller

    seller = db.query(Seller).filter(
        Seller.marketplace == listing_data['marketplace'],
        Seller.seller_name == listing_data.get('seller_name', 'Unknown')
    ).first()

    if not seller:
        seller = Seller(
            marketplace=listing_data['marketplace'],
            seller_id=listing_data.get('seller_name', 'Unknown'),
            seller_name=listing_data.get('seller_name'),
            trust_score=listing_data.get('seller_trust_score'),
            location_country=listing_data.get('location'),
        )
        db.add(seller)
        db.flush()

    # Check if listing exists
    existing = db.query(MarketplaceListing).filter(
        MarketplaceListing.listing_url == listing_data.get('listing_url')
    ).first()

    if existing:
        # Update existing listing
        old_price = existing.price_usd
        new_price = Decimal(str(listing_data['price_usd']))

        existing.price_amount = Decimal(str(listing_data['price_amount']))
        existing.currency = listing_data['currency']
        existing.price_usd = new_price
        existing.last_seen = datetime.utcnow()
        existing.is_active = True

        # Add to price history if price changed
        if old_price and abs(old_price - new_price) > Decimal('0.01'):
            price_history = PriceHistory(
                watch_id=watch.id,
                marketplace_listing_id=existing.id,
                marketplace=listing_data['marketplace'],
                price_amount=Decimal(str(listing_data['price_amount'])),
                currency=listing_data['currency'],
                price_usd=new_price,
                condition=listing_data.get('condition'),
                seller_trust_score=listing_data.get('seller_trust_score'),
                recorded_at=datetime.utcnow()
            )
            db.add(price_history)

        return 'updated'

    else:
        # Create new listing
        new_listing = MarketplaceListing(
            watch_id=watch.id,
            seller_id=seller.id,
            marketplace=listing_data['marketplace'],
            listing_url=listing_data.get('listing_url'),
            title=listing_data.get('title'),
            price_amount=Decimal(str(listing_data['price_amount'])),
            currency=listing_data['currency'],
            price_usd=Decimal(str(listing_data['price_usd'])),
            condition=listing_data.get('condition'),
            year=listing_data.get('year'),
            has_box=listing_data.get('has_box'),
            has_papers=listing_data.get('has_papers'),
            last_seen=datetime.utcnow(),
            is_active=True
        )
        db.add(new_listing)
        db.flush()

        # Add to price history
        price_history = PriceHistory(
            watch_id=watch.id,
            marketplace_listing_id=new_listing.id,
            marketplace=listing_data['marketplace'],
            price_amount=Decimal(str(listing_data['price_amount'])),
            currency=listing_data['currency'],
            price_usd=Decimal(str(listing_data['price_usd'])),
            condition=listing_data.get('condition'),
            seller_trust_score=listing_data.get('seller_trust_score'),
            recorded_at=datetime.utcnow()
        )
        db.add(price_history)

        return 'new'


def check_alert_condition(db, alert: PriceAlert) -> bool:
    """Check if an alert condition is met"""
    if alert.alert_type == 'below_threshold':
        # Find listings below threshold
        listings = db.query(MarketplaceListing).filter(
            MarketplaceListing.watch_id == alert.watch_id,
            MarketplaceListing.is_active == True,
            MarketplaceListing.price_usd <= alert.threshold_amount
        ).first()

        return listings is not None

    elif alert.alert_type == 'price_drop':
        # Check for recent price drops
        if not alert.percentage_drop:
            return False

        # Get recent price history
        recent = db.query(PriceHistory).filter(
            PriceHistory.watch_id == alert.watch_id
        ).order_by(PriceHistory.recorded_at.desc()).limit(10).all()

        if len(recent) < 2:
            return False

        # Check for significant drop
        latest_price = recent[0].price_usd
        previous_avg = sum(r.price_usd for r in recent[1:]) / len(recent[1:])

        drop_percent = ((previous_avg - latest_price) / previous_avg) * 100

        return drop_percent >= alert.percentage_drop

    return False


def get_triggering_listing(db, alert: PriceAlert):
    """Get the listing that triggered the alert"""
    return db.query(MarketplaceListing).filter(
        MarketplaceListing.watch_id == alert.watch_id,
        MarketplaceListing.is_active == True
    ).order_by(MarketplaceListing.price_usd).first()


if __name__ == '__main__':
    # Start Celery worker
    celery_app.start()
