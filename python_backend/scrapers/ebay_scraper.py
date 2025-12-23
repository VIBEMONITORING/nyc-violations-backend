"""
eBay Marketplace Scraper
Scrapes luxury watch listings with filtering
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
    parse_seller_rating,
    normalize_reference_number
)


class EbayScraper:
    """
    Scraper for eBay marketplace
    """

    def __init__(self):
        self.base_url = settings.EBAY_BASE_URL
        self.search_url = f"{self.base_url}/sch/i.html"
        self.currency_converter = CurrencyConverter()
        self.user_agent = settings.SCRAPING_USER_AGENT
        self.timeout = settings.SCRAPING_TIMEOUT
        self.max_results = settings.EBAY_MAX_RESULTS

    async def scrape_watch(
        self,
        reference_number: str,
        brand: Optional[str] = None,
        filters: Optional[Dict] = None
    ) -> List[Dict]:
        """
        Scrape eBay listings for a specific watch

        Args:
            reference_number: Watch reference/model number
            brand: Brand name
            filters: Filtering options
                - min_year: Minimum year
                - max_year: Maximum year
                - condition: Condition filter
                - min_price: Minimum price in USD
                - max_price: Maximum price in USD
                - region: Country/region filter

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
                search_term = f"{brand} {reference_number} watch" if brand else f"{reference_number} watch"
                logger.info(f"Searching eBay for: {search_term}")

                # Perform search
                await self._perform_search(page, search_term, filters)

                # Scrape listings
                page_listings = await self._scrape_page(page, filters)
                listings.extend(page_listings)

                logger.info(f"Found {len(listings)} eBay listings for {search_term}")

            except Exception as e:
                logger.error(f"Error scraping eBay: {e}")
            finally:
                await browser.close()

        # Apply post-processing filters
        filtered_listings = self._apply_filters(listings, filters)
        return filtered_listings

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
        """Perform search on eBay"""
        # Build search parameters
        params = {
            '_nkw': search_term,
            '_sacat': '31387',  # Wristwatches category
            'LH_TitleDesc': '0',
            '_sop': '12',  # Sort by: newly listed
        }

        # Add price filters
        if filters.get('min_price'):
            params['_udlo'] = str(filters['min_price'])
        if filters.get('max_price'):
            params['_udhi'] = str(filters['max_price'])

        # Add condition filter
        if filters.get('condition'):
            condition_codes = {
                'new': '1000',
                'unworn': '1500',
                'very-good': '3000',
                'good': '4000',
            }
            condition = filters['condition'].lower()
            if condition in condition_codes:
                params['LH_ItemCondition'] = condition_codes[condition]

        # Add region filter
        if filters.get('region'):
            # eBay region codes (examples)
            region_codes = {
                'US': '1',
                'UK': '3',
                'Europe': '3',
            }
            if filters['region'] in region_codes:
                params['LH_PrefLoc'] = region_codes[filters['region']]

        search_url = f"{self.search_url}?{urlencode(params)}"
        await page.goto(search_url, wait_until='networkidle', timeout=self.timeout)

        # Wait for results
        try:
            await page.wait_for_selector('.s-item', timeout=10000)
        except Exception:
            logger.warning("No eBay search results found")

    async def _scrape_page(self, page: Page, filters: Dict) -> List[Dict]:
        """Scrape all listings from current page"""
        listings = []

        try:
            # Wait for listings
            await page.wait_for_selector('.s-item', timeout=5000)

            # Get listing elements
            listing_elements = await page.query_selector_all('.s-item')

            for element in listing_elements:
                try:
                    listing = await self._extract_listing_data(element)
                    if listing:
                        listings.append(listing)

                    # Stop if we've reached max results
                    if len(listings) >= self.max_results:
                        break

                except Exception as e:
                    logger.debug(f"Error extracting listing: {e}")
                    continue

        except Exception as e:
            logger.error(f"Error scraping eBay page: {e}")

        return listings

    async def _extract_listing_data(self, element) -> Optional[Dict]:
        """Extract data from a single listing element"""
        try:
            # Skip sponsored items
            sponsored = await element.query_selector('.s-item__title--tagblock')
            if sponsored:
                sponsored_text = await sponsored.inner_text()
                if 'SPONSORED' in sponsored_text.upper():
                    return None

            # Title
            title_elem = await element.query_selector('.s-item__title')
            title = await title_elem.inner_text() if title_elem else ""

            # Skip placeholder items
            if 'Shop on eBay' in title:
                return None

            # Price
            price_elem = await element.query_selector('.s-item__price')
            price_text = await price_elem.inner_text() if price_elem else ""

            # Shipping
            shipping_elem = await element.query_selector('.s-item__shipping')
            shipping_text = await shipping_elem.inner_text() if shipping_elem else ""

            # Condition
            condition_elem = await element.query_selector('.SECONDARY_INFO')
            condition_text = await condition_elem.inner_text() if condition_elem else ""

            # Seller info
            seller_elem = await element.query_selector('.s-item__seller-info-text')
            seller_text = await seller_elem.inner_text() if seller_elem else ""

            # Location
            location_elem = await element.query_selector('.s-item__location')
            location = await location_elem.inner_text() if location_elem else ""

            # Listing URL
            link_elem = await element.query_selector('a.s-item__link')
            listing_url = await link_elem.get_attribute('href') if link_elem else ""

            # Parse price
            price_data = parse_price(price_text)
            if not price_data:
                return None

            # Parse seller rating
            seller_rating = parse_seller_rating(seller_text)

            listing = {
                'title': title.strip(),
                'price_amount': price_data['amount'],
                'currency': price_data['currency'],
                'price_usd': None,
                'condition': parse_condition(condition_text),
                'seller_name': self._extract_seller_name(seller_text),
                'seller_trust_score': seller_rating,
                'location': location.strip(),
                'shipping_cost': self._extract_shipping_cost(shipping_text),
                'listing_url': listing_url,
                'marketplace': 'ebay',
                'scraped_at': datetime.utcnow(),
                'has_box': None,
                'has_papers': None,
                'year': None,
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

            # Extract additional details
            listing = self._enrich_from_title(listing)

            return listing

        except Exception as e:
            logger.error(f"Error extracting eBay listing data: {e}")
            return None

    def _extract_seller_name(self, seller_text: str) -> str:
        """Extract seller name from seller info text"""
        # Typically format: "seller_name (rating%)"
        match = re.search(r'^([^(]+)', seller_text)
        if match:
            return match.group(1).strip()
        return seller_text.strip()

    def _extract_shipping_cost(self, shipping_text: str) -> Optional[Decimal]:
        """Extract shipping cost from shipping text"""
        if not shipping_text:
            return None

        if 'free' in shipping_text.lower():
            return Decimal('0')

        price_data = parse_price(shipping_text)
        if price_data:
            return price_data['amount']

        return None

    def _enrich_from_title(self, listing: Dict) -> Dict:
        """Extract additional information from listing title"""
        title_lower = listing['title'].lower()

        # Check for box and papers
        if 'box' in title_lower or 'full set' in title_lower:
            listing['has_box'] = True
        if 'papers' in title_lower or 'warranty' in title_lower or 'full set' in title_lower:
            listing['has_papers'] = True

        # Extract year
        year = parse_year(listing['title'])
        if year:
            listing['year'] = year

        # Extract reference number
        ref_patterns = [
            r'\b(\d{4,6}[A-Z]{0,2})\b',
            r'\bRef\.?\s*(\d{4,6}[A-Z]{0,2})\b',
            r'\b([A-Z]{2,3}\.\d{2,4}\.\d{2,4}\.\d{2,4})\b',
        ]

        for pattern in ref_patterns:
            match = re.search(pattern, listing['title'])
            if match:
                listing['reference_number'] = normalize_reference_number(match.group(1))
                break

        return listing

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

        # Filter by price
        if filters.get('min_price'):
            filtered = [
                l for l in filtered
                if l.get('price_usd') and l['price_usd'] >= filters['min_price']
            ]

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

        # Filter by seller trust score
        if filters.get('min_seller_score'):
            filtered = [
                l for l in filtered
                if l.get('seller_trust_score') and l['seller_trust_score'] >= filters['min_seller_score']
            ]

        return filtered


# Example usage
async def main():
    """Example usage of eBay scraper"""
    scraper = EbayScraper()

    filters = {
        'min_year': 2020,
        'condition': 'new',
        'max_price': 50000,
    }

    listings = await scraper.scrape_watch(
        reference_number='126710BLRO',
        brand='Rolex',
        filters=filters
    )

    print(f"Found {len(listings)} eBay listings")
    for listing in listings[:5]:
        print(f"- {listing['title']}: ${listing['price_usd']:.2f}")


if __name__ == "__main__":
    asyncio.run(main())
