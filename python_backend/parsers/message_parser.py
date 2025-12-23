"""
Message-Based Listing Parser
Parse product listings from messaging platforms (WhatsApp, Telegram, Slack)
Extract structured data from shorthand formats
"""
import re
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from loguru import logger
from pydantic import BaseModel, Field

from python_backend.utils.parsers import (
    parse_price,
    parse_condition,
    parse_year,
    extract_reference_from_text,
    extract_brand_and_model,
    normalize_reference_number,
)


class ParsedListing(BaseModel):
    """Structured representation of a parsed listing"""
    brand: Optional[str] = None
    model: Optional[str] = None
    reference_number: Optional[str] = None
    year: Optional[int] = None
    condition: Optional[str] = None
    price_amount: Optional[Decimal] = None
    currency: Optional[str] = None
    has_box: Optional[bool] = None
    has_papers: Optional[bool] = None
    warranty_months: Optional[int] = None
    seller_notes: Optional[str] = None
    confidence_score: Decimal = Field(default=Decimal('0.0'))
    raw_text: str = ""


class MessageParser:
    """
    Parse watch listings from messaging platform messages

    Handles various shorthand formats:
        - "Rolex 116500LN 2023 new 42k usd box papers"
        - "AP 15400ST €38,000 unworn full set"
        - "Patek 5711/1A blue dial £85k good condition"
        - "Omega Speedmaster ref 310.30.42.50.01.001 2022 $6500"
    """

    def __init__(self):
        self.patterns = self._compile_patterns()

    def parse_message(self, message: str, source: str = 'whatsapp') -> List[ParsedListing]:
        """
        Parse a message that may contain one or more watch listings

        Args:
            message: Raw message text
            source: Message source ('whatsapp', 'telegram', 'slack')

        Returns:
            List of ParsedListing objects
        """
        # Split message into potential individual listings
        # Common delimiters: newlines, bullet points, numbers
        listings_texts = self._split_message(message)

        parsed_listings = []
        for listing_text in listings_texts:
            try:
                parsed = self._parse_single_listing(listing_text)
                if parsed and self._is_valid_listing(parsed):
                    parsed.raw_text = listing_text
                    parsed.confidence_score = self._calculate_confidence(parsed)
                    parsed_listings.append(parsed)
            except Exception as e:
                logger.debug(f"Error parsing listing: {e}")
                continue

        return parsed_listings

    def _split_message(self, message: str) -> List[str]:
        """Split message into individual listings"""
        # Remove common prefixes
        message = re.sub(r'^(available|for sale|stock|inventory):\s*', '', message, flags=re.IGNORECASE)

        # Split by common delimiters
        # - Newlines
        # - Numbered lists (1., 2., etc.)
        # - Bullet points (•, -, *)
        listings = []

        # Try numbered list first
        numbered_pattern = r'\d+[\.)]\s*([^\n]+(?:\n(?!\d+[\.)]).+)*)'
        numbered_matches = re.findall(numbered_pattern, message)
        if numbered_matches:
            listings.extend([m.strip() for m in numbered_matches])
        else:
            # Try bullet points
            bullet_pattern = r'[•\-\*]\s*([^\n]+(?:\n(?![•\-\*]).+)*)'
            bullet_matches = re.findall(bullet_pattern, message)
            if bullet_matches:
                listings.extend([m.strip() for m in bullet_matches])
            else:
                # Split by newlines
                lines = message.split('\n')
                listings.extend([line.strip() for line in lines if line.strip()])

        # Filter out very short listings (likely not valid)
        listings = [l for l in listings if len(l) > 10]

        return listings if listings else [message]

    def _parse_single_listing(self, text: str) -> ParsedListing:
        """Parse a single listing from text"""
        listing = ParsedListing(raw_text=text)

        # Extract brand and model
        brand_model = extract_brand_and_model(text)
        listing.brand = brand_model.get('brand')
        listing.model = brand_model.get('model')

        # Extract reference number
        listing.reference_number = extract_reference_from_text(text)

        # Extract price
        price_data = self._extract_price_from_text(text)
        if price_data:
            listing.price_amount = price_data['amount']
            listing.currency = price_data['currency']

        # Extract year
        listing.year = parse_year(text)

        # Extract condition
        listing.condition = parse_condition(text)

        # Extract box and papers
        listing.has_box = self._extract_box(text)
        listing.has_papers = self._extract_papers(text)

        # Extract warranty
        listing.warranty_months = self._extract_warranty(text)

        # Extract additional notes
        listing.seller_notes = self._extract_notes(text)

        return listing

    def _extract_price_from_text(self, text: str) -> Optional[Dict]:
        """
        Extract price from text with various formats

        Handles:
            - 42k usd
            - €38,000
            - $15000
            - £12.5k
            - 50000 USD
        """
        # Try multiple price patterns in order of specificity
        patterns = [
            # Pattern 1: Amount with K + currency code (42k usd)
            r'([\d,]+\.?\d*)\s*k\s*(usd|eur|gbp|chf|jpy|aud|cad)',
            # Pattern 2: Currency symbol + amount (€38,000)
            r'([$€£¥])\s*([\d,]+\.?\d*)\s*k?',
            # Pattern 3: Amount + currency code (50000 USD)
            r'([\d,]+\.?\d*)\s*(usd|eur|gbp|chf|jpy|aud|cad)',
            # Pattern 4: Currency symbol at end (15000$)
            r'([\d,]+\.?\d*)\s*([$€£¥])',
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return parse_price(match.group(0))

        return None

    def _extract_box(self, text: str) -> Optional[bool]:
        """Extract box information"""
        text_lower = text.lower()

        # Negative indicators
        if 'no box' in text_lower or 'without box' in text_lower:
            return False

        # Positive indicators
        box_keywords = ['box', 'full set', 'complete set', 'full kit']
        for keyword in box_keywords:
            if keyword in text_lower:
                return True

        return None

    def _extract_papers(self, text: str) -> Optional[bool]:
        """Extract papers/warranty information"""
        text_lower = text.lower()

        # Negative indicators
        if 'no papers' in text_lower or 'without papers' in text_lower:
            return False

        # Positive indicators
        papers_keywords = ['papers', 'warranty', 'certificate', 'full set', 'complete set']
        for keyword in papers_keywords:
            if keyword in text_lower:
                return True

        return None

    def _extract_warranty(self, text: str) -> Optional[int]:
        """Extract warranty duration in months"""
        # Patterns for warranty: "2 year warranty", "24 months warranty"
        patterns = [
            r'(\d+)\s*year(?:s)?\s*warranty',
            r'(\d+)\s*month(?:s)?\s*warranty',
            r'warranty:\s*(\d+)\s*(?:year|yr|month|mo)',
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                amount = int(match.group(1))
                # Check if it's years or months
                if 'year' in match.group(0).lower() or 'yr' in match.group(0).lower():
                    return amount * 12
                return amount

        return None

    def _extract_notes(self, text: str) -> Optional[str]:
        """Extract additional seller notes"""
        # Look for common note patterns
        note_patterns = [
            r'(?:note|notes):\s*(.+)',
            r'(?:condition|comment):\s*(.+)',
            r'\(([^)]+)\)$',  # Text in parentheses at end
        ]

        for pattern in note_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()

        return None

    def _is_valid_listing(self, listing: ParsedListing) -> bool:
        """Check if parsed listing has minimum required fields"""
        # Must have at least:
        # - Brand OR reference number
        # - Price OR year
        has_identifier = listing.brand or listing.reference_number
        has_value_indicator = listing.price_amount or listing.year

        return has_identifier and has_value_indicator

    def _calculate_confidence(self, listing: ParsedListing) -> Decimal:
        """
        Calculate confidence score for parsed listing (0.0 - 1.0)

        Higher score = more complete and reliable data
        """
        score = Decimal('0.0')
        max_score = Decimal('10.0')

        # Brand (+2 points)
        if listing.brand:
            score += Decimal('2.0')

        # Reference number (+2 points)
        if listing.reference_number:
            score += Decimal('2.0')

        # Price (+2 points)
        if listing.price_amount:
            score += Decimal('2.0')

        # Year (+1 point)
        if listing.year:
            score += Decimal('1.0')

        # Condition (+1 point)
        if listing.condition:
            score += Decimal('1.0')

        # Box and papers (+1 point each)
        if listing.has_box is not None:
            score += Decimal('0.5')
        if listing.has_papers is not None:
            score += Decimal('0.5')

        # Model (+1 point bonus if we have brand + model + ref)
        if listing.model and listing.brand and listing.reference_number:
            score += Decimal('1.0')

        return round(score / max_score, 2)

    def _compile_patterns(self) -> Dict:
        """Compile regex patterns for parsing"""
        return {
            'price': [
                re.compile(r'([\d,]+\.?\d*)\s*k\s*(usd|eur|gbp|chf)', re.IGNORECASE),
                re.compile(r'([$€£¥])\s*([\d,]+\.?\d*)'),
            ],
            'year': re.compile(r'\b(19\d{2}|20\d{2})\b'),
            'reference': [
                re.compile(r'\bRef\.?\s*([A-Z0-9.-]{4,15})\b', re.IGNORECASE),
                re.compile(r'\b(\d{5,6}[A-Z]{0,4})\b'),
            ],
        }

    def parse_batch(self, messages: List[Dict[str, str]]) -> Dict[str, List[ParsedListing]]:
        """
        Parse multiple messages in batch

        Args:
            messages: List of dicts with 'id', 'text', 'source', 'sender'

        Returns:
            Dictionary mapping message IDs to parsed listings
        """
        results = {}

        for msg in messages:
            msg_id = msg.get('id', str(hash(msg.get('text', ''))))
            text = msg.get('text', '')
            source = msg.get('source', 'unknown')

            try:
                listings = self.parse_message(text, source)
                results[msg_id] = listings
                logger.info(f"Parsed {len(listings)} listings from message {msg_id}")
            except Exception as e:
                logger.error(f"Error parsing message {msg_id}: {e}")
                results[msg_id] = []

        return results


# Example usage
def main():
    """Example usage of message parser"""
    parser = MessageParser()

    # Example messages
    messages = [
        "Rolex 116500LN 2023 new 42k usd box papers",
        "AP 15400ST €38,000 unworn full set",
        "Patek 5711/1A blue dial £85k good condition no box",
        """Available watches:
        1. Rolex Daytona 116500 2022 $35,000 excellent condition
        2. Omega Speedmaster 310.30.42.50.01.001 2023 $6500 new
        3. Cartier Santos WSSA0029 €7,200 very good box+papers
        """,
        "Submariner 126610LN unworn 2024 13.5k full set 5yr warranty",
    ]

    for msg in messages:
        print(f"\nMessage: {msg[:50]}...")
        listings = parser.parse_message(msg)

        for listing in listings:
            print(f"\n  Parsed listing (confidence: {listing.confidence_score}):")
            print(f"    Brand: {listing.brand}")
            print(f"    Reference: {listing.reference_number}")
            print(f"    Year: {listing.year}")
            print(f"    Price: {listing.price_amount} {listing.currency}")
            print(f"    Condition: {listing.condition}")
            print(f"    Box: {listing.has_box}, Papers: {listing.has_papers}")


if __name__ == "__main__":
    main()
