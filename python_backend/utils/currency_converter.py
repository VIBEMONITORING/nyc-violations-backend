"""
Currency conversion utilities
"""
import asyncio
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, Optional

import httpx
from loguru import logger

from python_backend.config.config import settings


class CurrencyConverter:
    """
    Currency converter with caching
    """

    def __init__(self):
        self.api_url = settings.CURRENCY_API_URL
        self.api_key = settings.CURRENCY_API_KEY
        self.base_currency = settings.BASE_CURRENCY
        self._rates: Dict[str, Decimal] = {}
        self._last_update: Optional[datetime] = None
        self._cache_duration = timedelta(hours=1)

    async def convert(
        self,
        amount: Decimal,
        from_currency: str,
        to_currency: str = 'USD'
    ) -> Decimal:
        """
        Convert amount from one currency to another

        Args:
            amount: Amount to convert
            from_currency: Source currency code (e.g., 'EUR')
            to_currency: Target currency code (default: 'USD')

        Returns:
            Converted amount
        """
        if from_currency == to_currency:
            return amount

        # Ensure rates are up to date
        await self._update_rates_if_needed()

        # Get exchange rates
        from_rate = self._rates.get(from_currency, Decimal('1.0'))
        to_rate = self._rates.get(to_currency, Decimal('1.0'))

        # Convert: amount * (to_rate / from_rate)
        if from_currency == self.base_currency:
            converted = amount * to_rate
        elif to_currency == self.base_currency:
            converted = amount / from_rate
        else:
            # Convert through base currency
            in_base = amount / from_rate
            converted = in_base * to_rate

        return round(converted, 2)

    async def _update_rates_if_needed(self):
        """Update exchange rates if cache has expired"""
        now = datetime.utcnow()

        if (not self._last_update or
            now - self._last_update > self._cache_duration or
            not self._rates):
            await self._fetch_rates()

    async def _fetch_rates(self):
        """Fetch latest exchange rates from API"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    self.api_url,
                    timeout=10.0
                )
                response.raise_for_status()

                data = response.json()
                rates = data.get('rates', {})

                # Convert to Decimal
                self._rates = {
                    currency: Decimal(str(rate))
                    for currency, rate in rates.items()
                }

                # Add base currency
                self._rates[self.base_currency] = Decimal('1.0')

                self._last_update = datetime.utcnow()
                logger.info(f"Updated currency rates: {len(self._rates)} currencies")

        except Exception as e:
            logger.error(f"Error fetching currency rates: {e}")
            # Use fallback rates if API fails
            self._use_fallback_rates()

    def _use_fallback_rates(self):
        """Use hardcoded fallback rates when API is unavailable"""
        logger.warning("Using fallback currency rates")
        self._rates = {
            'USD': Decimal('1.0'),
            'EUR': Decimal('0.92'),
            'GBP': Decimal('0.79'),
            'JPY': Decimal('149.50'),
            'CHF': Decimal('0.88'),
            'AUD': Decimal('1.52'),
            'CAD': Decimal('1.35'),
            'HKD': Decimal('7.83'),
            'SGD': Decimal('1.34'),
        }
        self._last_update = datetime.utcnow()

    def get_rate(self, currency: str) -> Optional[Decimal]:
        """Get current exchange rate for a currency"""
        return self._rates.get(currency)

    def get_all_rates(self) -> Dict[str, Decimal]:
        """Get all current exchange rates"""
        return self._rates.copy()


# Singleton instance
_converter = None


def get_currency_converter() -> CurrencyConverter:
    """Get singleton instance of currency converter"""
    global _converter
    if _converter is None:
        _converter = CurrencyConverter()
    return _converter


async def convert_to_usd(amount: Decimal, currency: str) -> Decimal:
    """
    Helper function to convert any currency to USD

    Args:
        amount: Amount to convert
        currency: Source currency code

    Returns:
        Amount in USD
    """
    converter = get_currency_converter()
    return await converter.convert(amount, currency, 'USD')
