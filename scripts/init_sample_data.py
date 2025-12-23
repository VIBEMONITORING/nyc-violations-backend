"""
Initialize sample data for testing the Luxury Watch Pricing Intelligence Engine
"""
from datetime import datetime, timedelta
from decimal import Decimal
import random

from python_backend.database.db import get_db_context
from python_backend.models.models import Brand, Watch, Seller, MarketplaceListing, PriceHistory
from python_backend.analytics.business_rules import create_default_rules
from loguru import logger


def create_sample_brands(db):
    """Create sample watch brands"""
    brands_data = [
        {'name': 'Rolex', 'slug': 'rolex'},
        {'name': 'Patek Philippe', 'slug': 'patek-philippe'},
        {'name': 'Audemars Piguet', 'slug': 'audemars-piguet'},
        {'name': 'Omega', 'slug': 'omega'},
        {'name': 'TAG Heuer', 'slug': 'tag-heuer'},
        {'name': 'Breitling', 'slug': 'breitling'},
        {'name': 'IWC', 'slug': 'iwc'},
        {'name': 'Cartier', 'slug': 'cartier'},
    ]

    brands = []
    for brand_data in brands_data:
        existing = db.query(Brand).filter(Brand.slug == brand_data['slug']).first()
        if not existing:
            brand = Brand(**brand_data)
            db.add(brand)
            brands.append(brand)
        else:
            brands.append(existing)

    db.commit()
    logger.info(f"Created {len(brands)} brands")
    return brands


def create_sample_watches(db, brands):
    """Create sample watches"""
    watches_data = [
        # Rolex
        {'brand': 'Rolex', 'reference_number': '116500LN', 'model': 'Daytona', 'case_material': 'Steel', 'dial_color': 'Black'},
        {'brand': 'Rolex', 'reference_number': '126610LN', 'model': 'Submariner Date', 'case_material': 'Steel', 'dial_color': 'Black'},
        {'brand': 'Rolex', 'reference_number': '126710BLRO', 'model': 'GMT-Master II', 'case_material': 'Steel', 'dial_color': 'Black'},
        {'brand': 'Rolex', 'reference_number': '124300', 'model': 'Oyster Perpetual', 'case_material': 'Steel', 'dial_color': 'Green'},

        # Patek Philippe
        {'brand': 'Patek Philippe', 'reference_number': '5711/1A-010', 'model': 'Nautilus', 'case_material': 'Steel', 'dial_color': 'Blue'},
        {'brand': 'Patek Philippe', 'reference_number': '5167A-001', 'model': 'Aquanaut', 'case_material': 'Steel', 'dial_color': 'Black'},

        # Audemars Piguet
        {'brand': 'Audemars Piguet', 'reference_number': '15400ST', 'model': 'Royal Oak', 'case_material': 'Steel', 'dial_color': 'Blue'},
        {'brand': 'Audemars Piguet', 'reference_number': '15500ST', 'model': 'Royal Oak', 'case_material': 'Steel', 'dial_color': 'Black'},

        # Omega
        {'brand': 'Omega', 'reference_number': '310.30.42.50.01.001', 'model': 'Speedmaster Professional', 'case_material': 'Steel', 'dial_color': 'Black'},
        {'brand': 'Omega', 'reference_number': '210.30.42.20.01.001', 'model': 'Seamaster', 'case_material': 'Steel', 'dial_color': 'Black'},
    ]

    brand_map = {b.name: b for b in brands}
    watches = []

    for watch_data in watches_data:
        brand_name = watch_data.pop('brand')
        brand = brand_map.get(brand_name)

        if brand:
            existing = db.query(Watch).filter(
                Watch.brand_id == brand.id,
                Watch.reference_number == watch_data['reference_number']
            ).first()

            if not existing:
                watch = Watch(brand_id=brand.id, **watch_data)
                db.add(watch)
                watches.append(watch)
            else:
                watches.append(existing)

    db.commit()
    logger.info(f"Created {len(watches)} watches")
    return watches


def create_sample_sellers(db):
    """Create sample sellers"""
    sellers_data = [
        {'marketplace': 'chrono24', 'seller_id': 'seller_001', 'seller_name': 'WatchMaster Pro', 'trust_score': Decimal('0.95'), 'location_country': 'Germany'},
        {'marketplace': 'chrono24', 'seller_id': 'seller_002', 'seller_name': 'Luxury Time', 'trust_score': Decimal('0.88'), 'location_country': 'Switzerland'},
        {'marketplace': 'chrono24', 'seller_id': 'seller_003', 'seller_name': 'Premier Watches', 'trust_score': Decimal('0.92'), 'location_country': 'USA'},
        {'marketplace': 'ebay', 'seller_id': 'seller_004', 'seller_name': 'TimeKeeper', 'trust_score': Decimal('0.85'), 'location_country': 'UK'},
        {'marketplace': 'ebay', 'seller_id': 'seller_005', 'seller_name': 'Watch Vault', 'trust_score': Decimal('0.90'), 'location_country': 'USA'},
    ]

    sellers = []
    for seller_data in sellers_data:
        existing = db.query(Seller).filter(
            Seller.marketplace == seller_data['marketplace'],
            Seller.seller_id == seller_data['seller_id']
        ).first()

        if not existing:
            seller = Seller(**seller_data)
            db.add(seller)
            sellers.append(seller)
        else:
            sellers.append(existing)

    db.commit()
    logger.info(f"Created {len(sellers)} sellers")
    return sellers


def create_sample_listings(db, watches, sellers):
    """Create sample marketplace listings"""
    conditions = ['new', 'unworn', 'very-good', 'good']
    years = [2023, 2022, 2021, 2020]

    listings = []
    for watch in watches:
        # Create 3-5 listings per watch
        num_listings = random.randint(3, 5)

        for i in range(num_listings):
            seller = random.choice(sellers)
            condition = random.choice(conditions)
            year = random.choice(years)

            # Generate price based on watch (simplified)
            base_prices = {
                '116500LN': 35000,
                '126610LN': 14000,
                '126710BLRO': 18000,
                '124300': 7000,
                '5711/1A-010': 120000,
                '5167A-001': 35000,
                '15400ST': 38000,
                '15500ST': 45000,
                '310.30.42.50.01.001': 6500,
                '210.30.42.20.01.001': 5500,
            }

            base_price = base_prices.get(watch.reference_number, 10000)

            # Add variance
            price_variance = random.uniform(0.9, 1.15)
            price_usd = Decimal(str(int(base_price * price_variance)))

            listing = MarketplaceListing(
                watch_id=watch.id,
                seller_id=seller.id,
                marketplace=seller.marketplace,
                listing_url=f"https://{seller.marketplace}.com/listing/{watch.reference_number}/{i}",
                title=f"{watch.brand.name} {watch.reference_number} {watch.model}",
                price_amount=price_usd,
                currency='USD',
                price_usd=price_usd,
                condition=condition,
                year=year,
                has_box=random.choice([True, False, None]),
                has_papers=random.choice([True, False, None]),
                listing_date=datetime.utcnow().date() - timedelta(days=random.randint(0, 30)),
                last_seen=datetime.utcnow(),
                is_active=True
            )

            db.add(listing)
            listings.append(listing)

    db.commit()
    logger.info(f"Created {len(listings)} listings")
    return listings


def create_sample_price_history(db, listings):
    """Create sample price history"""
    history_records = []

    for listing in listings:
        # Create 5-10 historical price points
        num_points = random.randint(5, 10)

        for i in range(num_points):
            days_ago = (num_points - i) * 3
            recorded_at = datetime.utcnow() - timedelta(days=days_ago)

            # Price varies slightly over time
            price_variance = random.uniform(0.95, 1.05)
            historical_price = listing.price_usd * Decimal(str(price_variance))

            history = PriceHistory(
                watch_id=listing.watch_id,
                marketplace_listing_id=listing.id,
                marketplace=listing.marketplace,
                price_amount=historical_price,
                currency='USD',
                price_usd=historical_price,
                condition=listing.condition,
                seller_trust_score=listing.seller.trust_score if listing.seller else None,
                location_country=listing.seller.location_country if listing.seller else None,
                recorded_at=recorded_at
            )

            db.add(history)
            history_records.append(history)

    db.commit()
    logger.info(f"Created {len(history_records)} price history records")
    return history_records


def main():
    """Initialize all sample data"""
    logger.info("Starting sample data initialization")

    with get_db_context() as db:
        # Create business rules
        logger.info("Creating business rules")
        create_default_rules(db)

        # Create sample data
        brands = create_sample_brands(db)
        watches = create_sample_watches(db, brands)
        sellers = create_sample_sellers(db)
        listings = create_sample_listings(db, watches, sellers)
        price_history = create_sample_price_history(db, listings)

    logger.info("Sample data initialization completed!")
    logger.info(f"Summary:")
    logger.info(f"  - Brands: {len(brands)}")
    logger.info(f"  - Watches: {len(watches)}")
    logger.info(f"  - Sellers: {len(sellers)}")
    logger.info(f"  - Listings: {len(listings)}")
    logger.info(f"  - Price History: {len(price_history)}")


if __name__ == "__main__":
    main()
