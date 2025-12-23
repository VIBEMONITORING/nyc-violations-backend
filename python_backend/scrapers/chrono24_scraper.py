"""
Chrono24 Marketplace Scraper
Scrapes luxury watch listings with filtering by year, condition, seller trust, and region
"""
import asyncio
import re
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional
from urllib.parse import urlencode, urljoin

from playwright.async_api import async_playwright, Page, Browser
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

from python_backend.config.config import settings
from python_backend.utils.currency_converter import CurrencyConverter
from python_backend.utils.parsers import (
    parse_price,
    parse_condition,
    parse_year,
    normalize_reference_number
)


class Chrono24Scraper:
    """
    Scraper for Chrono24 marketplace
    """

    def __init__(self):
        self.base_url = settings.CHRONO24_BASE_URL
        self.search_url = settings.CHRONO24_SEARCH_URL
        self.currency_converter = CurrencyConverter()
        self.user_agent = settings.SCRAPING_USER_AGENT
        self.timeout = settings.SCRAPING_TIMEOUT
        self.max_pages = settings.CHRONO24_MAX_PAGES

    async def scrape_watch(
        self,
        reference_number: str,
        brand: Optional[str] = None,
        filters: Optional[Dict] = None
    ) -> List[Dict]:
        """
        Scrape listings for a specific watch reference number

        Args:
            reference_number: Watch reference/model number
            brand: Brand name (optional, helps with search)
            filters: Additional filters
                - min_year: Minimum year
                - max_year: Maximum year
                - condition: Condition filter (new, unworn, very-good, good)
                - min_seller_score: Minimum seller trust score (0-1)
                - region: Region/country filter
                - max_price: Maximum price in USD

        Returns:
            List of listing dictionaries
        """
        filters = filters or {}
        listings = []

        async with async_playwright() as p:
            browser = await self._launch_browser(p)
            try:
                page = await browser.new_page()
                await self._setup_page(page)

                # Build search query
                search_term = f"{brand} {reference_number}" if brand else reference_number
                logger.info(f"Searching Chrono24 for: {search_term}")

                # Perform search
                await self._perform_search(page, search_term, filters)

                # Scrape multiple pages
                for page_num in range(1, self.max_pages + 1):
                    logger.info(f"Scraping page {page_num}")

                    page_listings = await self._scrape_page(page, filters)
                    if not page_listings:
                        logger.info("No more listings found")
                        break

                    listings.extend(page_listings)

                    # Check if there's a next page
                    has_next = await self._has_next_page(page)
                    if not has_next:
                        break

                    # Go to next page
                    await self._go_to_next_page(page)
                    await asyncio.sleep(2)  # Rate limiting

                logger.info(f"Found {len(listings)} listings for {search_term}")

            except Exception as e:
                logger.error(f"Error scraping Chrono24: {e}")
            finally:
                await browser.close()

        # Post-process and filter
        filtered_listings = self._apply_filters(listings, filters)
        return filtered_listings

    async def scrape_multiple_watches(
        self,
        watch_list: List[Dict[str, str]],
        filters: Optional[Dict] = None
    ) -> Dict[str, List[Dict]]:
        """
        Scrape listings for multiple watches

        Args:
            watch_list: List of dicts with 'brand' and 'reference_number'
            filters: Filters to apply to all searches

        Returns:
            Dictionary mapping reference numbers to their listings
        """
        results = {}

        async with async_playwright() as p:
            browser = await self._launch_browser(p)
            try:
                for watch_info in watch_list:
                    reference = watch_info.get('reference_number')
                    brand = watch_info.get('brand')

                    logger.info(f"Scraping {brand} {reference}")

                    listings = await self._scrape_watch_with_browser(
                        browser, reference, brand, filters
                    )
                    results[reference] = listings

                    # Rate limiting between searches
                    await asyncio.sleep(3)

            finally:
                await browser.close()

        return results

    async def _launch_browser(self, playwright) -> Browser:
        """Launch browser with appropriate settings"""
        browser_args = {
            'headless': True,
            'args': [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
            ]
        }

        if settings.USE_PROXY and settings.PROXY_URL:
            browser_args['proxy'] = {'server': settings.PROXY_URL}

        return await playwright.chromium.launch(**browser_args)

    async def _setup_page(self, page: Page):
        """Setup page with user agent and viewport"""
        await page.set_viewport_size({'width': 1920, 'height': 1080})
        await page.set_extra_http_headers({
            'User-Agent': self.user_agent,
            'Accept-Language': 'en-US,en;q=0.9',
        })

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def _perform_search(self, page: Page, search_term: str, filters: Dict):
        """Perform search on Chrono24"""
        # Build search URL
        params = {
            'query': search_term,
            'dosearch': 'true',
        }

        # Add filters to URL params
        if filters.get('condition'):
            params['condition'] = filters['condition']
        if filters.get('min_year'):
            params['yearFrom'] = filters['min_year']
        if filters.get('max_year'):
            params['yearTo'] = filters['max_year']

        search_url = f"{self.search_url}?{urlencode(params)}"
        await page.goto(search_url, wait_until='networkidle', timeout=self.timeout)

        # Wait for results to load
        try:
            await page.wait_for_selector('article.article-item', timeout=10000)
        except Exception:
            logger.warning("No search results found or page structure changed")

    async def _scrape_page(self, page: Page, filters: Dict) -> List[Dict]:
        """Scrape all listings from current page"""
        listings = []

        try:
            # Wait for listings to be visible
            await page.wait_for_selector('article.article-item', timeout=5000)

            # Get all listing elements
            listing_elements = await page.query_selector_all('article.article-item')

            for element in listing_elements:
                try:
                    listing = await self._extract_listing_data(element, page)
                    if listing:
                        listings.append(listing)
                except Exception as e:
                    logger.error(f"Error extracting listing: {e}")
                    continue

        except Exception as e:
            logger.error(f"Error scraping page: {e}")

        return listings

    async def _extract_listing_data(self, element, page: Page) -> Optional[Dict]:
        """Extract data from a single listing element"""
        try:
            # Title and reference
            title_elem = await element.query_selector('.article-item-title, .wt-search-result__title')
            title = await title_elem.inner_text() if title_elem else ""

            # Price
            price_elem = await element.query_selector('.article-item-price, .m-price')
            price_text = await price_elem.inner_text() if price_elem else ""

            # Seller
            seller_elem = await element.query_selector('.dealer-name, .m-seller-name')
            seller_name = await seller_elem.inner_text() if seller_elem else ""

            # Condition
            condition_elem = await element.query_selector('.article-item-condition, .m-condition')
            condition_text = await condition_elem.inner_text() if condition_elem else ""

            # Year
            year_elem = await element.query_selector('.article-item-year, .m-year')
            year_text = await year_elem.inner_text() if year_elem else ""

            # Listing URL
            link_elem = await element.query_selector('a[href]')
            listing_url = await link_elem.get_attribute('href') if link_elem else ""
            if listing_url and not listing_url.startswith('http'):
                listing_url = urljoin(self.base_url, listing_url)

            # Location
            location_elem = await element.query_selector('.m-seller-location, .location')
            location = await location_elem.inner_text() if location_elem else ""

            # Parse data
            price_data = parse_price(price_text)
            if not price_data:
                return None

            listing = {
                'title': title.strip(),
                'price_amount': price_data['amount'],
                'currency': price_data['currency'],
                'price_usd': None,  # Will be converted later
                'seller_name': seller_name.strip(),
                'condition': parse_condition(condition_text),
                'year': parse_year(year_text),
                'listing_url': listing_url,
                'location': location.strip(),
                'marketplace': 'chrono24',
                'scraped_at': datetime.utcnow(),
                'has_box': None,
                'has_papers': None,
                'seller_trust_score': None,
            }

            # Convert price to USD
            if price_data['currency'] != 'USD':
                listing['price_usd'] = await self.currency_converter.convert(
                    price_data['amount'],
                    price_data['currency'],
                    'USD'
                )
            else:
                listing['price_usd'] = price_data['amount']

            # Extract additional details from title
            listing = self._enrich_from_title(listing)

            return listing

        except Exception as e:
            logger.error(f"Error extracting listing data: {e}")
            return None

    def _enrich_from_title(self, listing: Dict) -> Dict:
        """Extract additional information from listing title"""
        title_lower = listing['title'].lower()

        # Check for box and papers
        if 'box' in title_lower or 'full set' in title_lower:
            listing['has_box'] = True
        if 'papers' in title_lower or 'warranty' in title_lower or 'full set' in title_lower:
            listing['has_papers'] = True

        # Extract reference number if present
        ref_patterns = [
            r'\b(\d{4,6}[A-Z]{0,2})\b',  # e.g., 116500LN
            r'\bRef\.?\s*(\d{4,6}[A-Z]{0,2})\b',
            r'\b([A-Z]{2,3}\.\d{2,4}\.\d{2,4}\.\d{2,4})\b',  # e.g., IW.371.446
        ]

        for pattern in ref_patterns:
            match = re.search(pattern, listing['title'])
            if match:
                listing['reference_number'] = normalize_reference_number(match.group(1))
                break

        return listing

    async def _has_next_page(self, page: Page) -> bool:
        """Check if there's a next page"""
        try:
            next_button = await page.query_selector(
                'a.next-page, button[aria-label="Next page"], .pagination-next'
            )
            if next_button:
                is_disabled = await next_button.get_attribute('disabled')
                return is_disabled is None
        except Exception:
            pass
        return False

    async def _go_to_next_page(self, page: Page):
        """Navigate to next page"""
        try:
            next_button = await page.query_selector(
                'a.next-page, button[aria-label="Next page"], .pagination-next'
            )
            if next_button:
                await next_button.click()
                await page.wait_for_load_state('networkidle')
        except Exception as e:
            logger.error(f"Error going to next page: {e}")

    async def _scrape_watch_with_browser(
        self,
        browser: Browser,
        reference_number: str,
        brand: Optional[str],
        filters: Optional[Dict]
    ) -> List[Dict]:
        """Scrape watch using existing browser instance"""
        listings = []

        try:
            page = await browser.new_page()
            await self._setup_page(page)

            search_term = f"{brand} {reference_number}" if brand else reference_number
            await self._perform_search(page, search_term, filters or {})

            for page_num in range(1, self.max_pages + 1):
                page_listings = await self._scrape_page(page, filters or {})
                if not page_listings:
                    break

                listings.extend(page_listings)

                has_next = await self._has_next_page(page)
                if not has_next:
                    break

                await self._go_to_next_page(page)
                await asyncio.sleep(2)

            await page.close()

        except Exception as e:
            logger.error(f"Error in _scrape_watch_with_browser: {e}")

        return listings

    def _apply_filters(self, listings: List[Dict], filters: Dict) -> List[Dict]:
        """Apply post-scraping filters"""
        filtered = listings

        # Filter by year
        if filters.get('min_year'):
            filtered = [
                l for l in filtered
                if l.get('year') and l['year'] >= filters['min_year']
            ]

        if filters.get('max_year'):
            filtered = [
                l for l in filtered
                if l.get('year') and l['year'] <= filters['max_year']
            ]

        # Filter by max price
        if filters.get('max_price'):
            filtered = [
                l for l in filtered
                if l.get('price_usd') and l['price_usd'] <= filters['max_price']
            ]

        # Filter by condition
        if filters.get('condition'):
            condition_filter = filters['condition'].lower()
            filtered = [
                l for l in filtered
                if l.get('condition') and condition_filter in l['condition'].lower()
            ]

        # Filter by seller trust score (if available)
        if filters.get('min_seller_score'):
            filtered = [
                l for l in filtered
                if l.get('seller_trust_score') and l['seller_trust_score'] >= filters['min_seller_score']
            ]

        return filtered


# Example usage
async def main():
    """Example usage of Chrono24 scraper"""
    scraper = Chrono24Scraper()

    # Scrape a specific watch
    filters = {
        'min_year': 2020,
        'condition': 'new',
        'max_price': 50000,
    }

    listings = await scraper.scrape_watch(
        reference_number='116500LN',
        brand='Rolex',
        filters=filters
    )

    print(f"Found {len(listings)} listings")
    for listing in listings[:5]:
        print(f"- {listing['title']}: ${listing['price_usd']:.2f}")


if __name__ == "__main__":
    asyncio.run(main())
