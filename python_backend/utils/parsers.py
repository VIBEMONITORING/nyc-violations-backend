"""
Parsing utilities for extracting structured data from text
"""
import re
from decimal import Decimal
from typing import Dict, Optional

from python_backend.config.config import CURRENCY_SYMBOLS, CONDITION_MAPPING


def parse_price(price_text: str) -> Optional[Dict[str, any]]:
    """
    Parse price from text with various formats

    Examples:
        "$15,000" -> {'amount': 15000, 'currency': 'USD'}
        "€38,000" -> {'amount': 38000, 'currency': 'EUR'}
        "42k usd" -> {'amount': 42000, 'currency': 'USD'}
        "£12.5k" -> {'amount': 12500, 'currency': 'GBP'}

    Args:
        price_text: Price string to parse

    Returns:
        Dictionary with 'amount' (Decimal) and 'currency' (str), or None
    """
    if not price_text:
        return None

    # Clean the text
    text = price_text.strip().replace(',', '').replace(' ', '')

    # Detect currency from symbol
    currency = None
    for curr, symbol in CURRENCY_SYMBOLS.items():
        if symbol in text:
            currency = curr
            text = text.replace(symbol, '')
            break

    # Detect currency from code (USD, EUR, etc.)
    if not currency:
        currency_match = re.search(r'\b(USD|EUR|GBP|JPY|CHF|AUD|CAD|HKD|SGD)\b', text.upper())
        if currency_match:
            currency = currency_match.group(1)
            text = re.sub(r'\b(USD|EUR|GBP|JPY|CHF|AUD|CAD|HKD|SGD)\b', '', text, flags=re.IGNORECASE)

    # Default to USD if no currency found
    if not currency:
        currency = 'USD'

    # Parse amount with k/K multiplier
    # Matches: 42k, 12.5K, 1.2k, etc.
    k_match = re.search(r'([\d.]+)k', text, re.IGNORECASE)
    if k_match:
        amount = Decimal(k_match.group(1)) * 1000
        return {'amount': amount, 'currency': currency}

    # Parse regular amount
    # Matches: 15000, 15000.00, etc.
    amount_match = re.search(r'([\d.]+)', text)
    if amount_match:
        try:
            amount = Decimal(amount_match.group(1))
            return {'amount': amount, 'currency': currency}
        except Exception:
            return None

    return None


def parse_condition(condition_text: str) -> Optional[str]:
    """
    Normalize condition text to standard values

    Standard values: new, unworn, very-good, good, fair

    Args:
        condition_text: Condition string from listing

    Returns:
        Normalized condition string or None
    """
    if not condition_text:
        return None

    text_lower = condition_text.lower().strip()

    # Check against mapping
    for standard_condition, variants in CONDITION_MAPPING.items():
        for variant in variants:
            if variant in text_lower:
                return standard_condition

    # Fallback: try to detect common terms
    if 'new' in text_lower or 'unworn' in text_lower:
        return 'new'
    elif 'excellent' in text_lower or 'mint' in text_lower:
        return 'very-good'
    elif 'good' in text_lower:
        return 'good'
    elif 'fair' in text_lower or 'worn' in text_lower:
        return 'fair'

    return None


def parse_year(year_text: str) -> Optional[int]:
    """
    Extract year from text

    Args:
        year_text: Text potentially containing a year

    Returns:
        Year as integer or None
    """
    if not year_text:
        return None

    # Match 4-digit year (1900-2099)
    year_match = re.search(r'\b(19\d{2}|20\d{2})\b', year_text)
    if year_match:
        return int(year_match.group(1))

    return None


def normalize_reference_number(ref: str) -> str:
    """
    Normalize watch reference number

    Args:
        ref: Reference number string

    Returns:
        Normalized reference number
    """
    if not ref:
        return ""

    # Remove common prefixes
    ref = re.sub(r'^(ref\.?|reference\.?|model\.?)\s*', '', ref, flags=re.IGNORECASE)

    # Remove extra spaces and convert to uppercase
    ref = re.sub(r'\s+', '', ref).upper()

    # Remove special characters except hyphens and dots
    ref = re.sub(r'[^\w.-]', '', ref)

    return ref


def extract_reference_from_text(text: str) -> Optional[str]:
    """
    Extract watch reference number from free text

    Common patterns:
        - Rolex 116500LN
        - Ref. 116500LN
        - IW.371.446
        - 326934

    Args:
        text: Text to search

    Returns:
        Extracted reference number or None
    """
    if not text:
        return None

    patterns = [
        r'\bRef\.?\s*([A-Z0-9.-]{4,15})\b',  # Ref. 116500LN
        r'\bReference\.?\s*([A-Z0-9.-]{4,15})\b',
        r'\b([A-Z]{2,4}\.\d{2,4}\.\d{2,4}(?:\.\d{2,4})?)\b',  # IW.371.446
        r'\b(\d{5,6}[A-Z]{0,4})\b',  # 116500LN, 326934
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return normalize_reference_number(match.group(1))

    return None


def parse_seller_rating(rating_text: str) -> Optional[Decimal]:
    """
    Parse seller rating/trust score

    Examples:
        "4.8/5" -> 0.96
        "98%" -> 0.98
        "4.5 stars" -> 0.90

    Args:
        rating_text: Rating text

    Returns:
        Decimal between 0 and 1, or None
    """
    if not rating_text:
        return None

    text = rating_text.strip()

    # X/5 format
    slash_match = re.search(r'([\d.]+)/5', text)
    if slash_match:
        rating = Decimal(slash_match.group(1)) / 5
        return min(rating, Decimal('1.0'))

    # Percentage format
    percent_match = re.search(r'([\d.]+)%', text)
    if percent_match:
        rating = Decimal(percent_match.group(1)) / 100
        return min(rating, Decimal('1.0'))

    # Stars format (assumes out of 5)
    stars_match = re.search(r'([\d.]+)\s*stars?', text, re.IGNORECASE)
    if stars_match:
        rating = Decimal(stars_match.group(1)) / 5
        return min(rating, Decimal('1.0'))

    return None


def parse_boolean_feature(text: str, keywords: list) -> Optional[bool]:
    """
    Parse boolean feature from text (e.g., has box, has papers)

    Args:
        text: Text to search
        keywords: List of keywords to look for

    Returns:
        True if found, False if explicitly not found, None if unclear
    """
    if not text:
        return None

    text_lower = text.lower()

    # Check for negative indicators
    negative_patterns = [f"no {kw}" for kw in keywords] + [f"without {kw}" for kw in keywords]
    for pattern in negative_patterns:
        if pattern in text_lower:
            return False

    # Check for positive indicators
    for keyword in keywords:
        if keyword.lower() in text_lower:
            return True

    return None


def extract_brand_and_model(text: str) -> Dict[str, Optional[str]]:
    """
    Extract brand and model from text

    Args:
        text: Text containing brand and model

    Returns:
        Dictionary with 'brand' and 'model' keys
    """
    from python_backend.config.config import POPULAR_BRANDS

    result = {'brand': None, 'model': None}

    # Try to find brand
    text_upper = text.upper()
    for brand in POPULAR_BRANDS:
        if brand.upper() in text_upper:
            result['brand'] = brand
            # Extract model as remaining text after brand
            brand_pos = text_upper.find(brand.upper())
            model_text = text[brand_pos + len(brand):].strip()
            # Clean up model text
            model_text = re.sub(r'^[^\w]+', '', model_text)  # Remove leading non-word chars
            if model_text:
                result['model'] = model_text
            break

    return result
