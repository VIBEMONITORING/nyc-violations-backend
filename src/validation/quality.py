"""
NYC Violation Compliance System - Data Quality & Validation

Validates and cleans incoming data from NYC Open Data sources.
"""

import pandas as pd
import re
from typing import Dict, List, Tuple, Optional
from datetime import datetime
import logging


logger = logging.getLogger(__name__)


class DataQualityValidator:
    """
    Validate and clean incoming data with comprehensive quality checks
    """

    REQUIRED_FIELDS = {
        'inspections': ['camis', 'dba', 'inspection_date', 'violation_code'],
        'oath_open': ['respondent_name', 'hearing_date', 'violation_details'],
        'establishments': ['camis', 'dba', 'building', 'street', 'boro'],
    }

    VALID_BOROS = {'MANHATTAN', 'BROOKLYN', 'QUEENS', 'BRONX', 'STATEN ISLAND'}

    def __init__(self):
        self.validation_stats = {
            'total_processed': 0,
            'valid_records': 0,
            'invalid_records': 0,
            'issues': []
        }

    def validate_dataset(
        self,
        df: pd.DataFrame,
        dataset_type: str
    ) -> Tuple[pd.DataFrame, Dict]:
        """
        Validate and clean dataset

        Args:
            df: Input DataFrame
            dataset_type: Type of dataset (inspections, oath_open, etc.)

        Returns:
            Tuple of (cleaned_dataframe, quality_report)
        """

        report = {
            'total_records': len(df),
            'valid_records': 0,
            'removed_records': 0,
            'quality_score': 0.0,
            'issues': []
        }

        if df.empty:
            report['quality_score'] = 0.0
            return df, report

        # Check required fields
        if dataset_type in self.REQUIRED_FIELDS:
            missing_fields = set(self.REQUIRED_FIELDS[dataset_type]) - set(df.columns)
            if missing_fields:
                report['issues'].append(f"Missing required fields: {missing_fields}")
                return pd.DataFrame(), report

        # Remove duplicates
        original_len = len(df)
        if dataset_type == 'inspections':
            df = df.drop_duplicates(subset=['camis', 'inspection_date', 'violation_code'])
        else:
            df = df.drop_duplicates()

        duplicates_removed = original_len - len(df)
        if duplicates_removed > 0:
            report['issues'].append(f"Removed {duplicates_removed} duplicates")

        # Clean phone numbers
        if 'phone' in df.columns:
            df['phone'] = df['phone'].apply(self._clean_phone)
            valid_phones = df['phone'].notna().sum()
            logger.info(f"Valid phone numbers: {valid_phones}/{len(df)}")

        # Extract/validate emails
        if 'email' in df.columns or 'dba' in df.columns:
            # Try to extract email from text fields
            if 'dba' in df.columns:
                df['email'] = df['dba'].apply(self._extract_email)

        # Standardize addresses
        if all(col in df.columns for col in ['building', 'street', 'boro']):
            df = self._standardize_addresses(df)

        # Validate dates
        date_columns = [col for col in df.columns if 'date' in col.lower()]
        for date_col in date_columns:
            if date_col in df.columns:
                df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
                invalid_dates = df[date_col].isna().sum()
                if invalid_dates > 0:
                    report['issues'].append(f"{invalid_dates} invalid dates in {date_col}")

        # Remove records with missing critical fields
        critical_nulls_before = len(df)
        if dataset_type == 'inspections':
            df = df.dropna(subset=['camis', 'inspection_date'])
        critical_nulls_removed = critical_nulls_before - len(df)
        if critical_nulls_removed > 0:
            report['issues'].append(f"Removed {critical_nulls_removed} records with missing critical fields")

        # Validate borough names
        if 'boro' in df.columns:
            df['boro'] = df['boro'].str.upper()
            invalid_boros = ~df['boro'].isin(self.VALID_BOROS)
            invalid_count = invalid_boros.sum()
            if invalid_count > 0:
                report['issues'].append(f"{invalid_count} invalid borough names")
                df.loc[invalid_boros, 'boro'] = None

        # Validate zipcodes
        if 'zipcode' in df.columns:
            df['zipcode'] = df['zipcode'].apply(self._clean_zipcode)

        # Calculate quality metrics
        report['valid_records'] = len(df)
        report['removed_records'] = report['total_records'] - report['valid_records']
        report['quality_score'] = (
            report['valid_records'] / report['total_records']
            if report['total_records'] > 0 else 0.0
        )

        logger.info(f"Validation complete: {report['valid_records']}/{report['total_records']} valid ({report['quality_score']:.2%})")

        return df, report

    def _clean_phone(self, phone: str) -> Optional[str]:
        """
        Extract and format phone number

        Args:
            phone: Raw phone number string

        Returns:
            Formatted phone number or None
        """
        if pd.isna(phone):
            return None

        # Remove non-digits
        digits = re.sub(r'\D', '', str(phone))

        # Validate 10-digit US number
        if len(digits) == 10:
            return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
        elif len(digits) == 11 and digits[0] == '1':
            return f"({digits[1:4]}) {digits[4:7]}-{digits[7:]}"

        return None

    def _extract_email(self, text: str) -> Optional[str]:
        """
        Extract email from text field

        Args:
            text: Text potentially containing email

        Returns:
            Extracted email or None
        """
        if pd.isna(text):
            return None

        # Email regex pattern
        pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        matches = re.findall(pattern, str(text))

        return matches[0] if matches else None

    def _clean_zipcode(self, zipcode: str) -> Optional[str]:
        """
        Clean and validate NYC zipcode

        Args:
            zipcode: Raw zipcode

        Returns:
            Cleaned 5-digit zipcode or None
        """
        if pd.isna(zipcode):
            return None

        # Extract digits
        digits = re.sub(r'\D', '', str(zipcode))

        # Take first 5 digits (ignore +4 extension)
        if len(digits) >= 5:
            zip5 = digits[:5]
            # Validate NYC zipcode ranges
            # Manhattan: 10001-10282, Bronx: 10451-10475, Brooklyn: 11201-11256
            # Queens: 11004-11697, Staten Island: 10301-10314
            zip_int = int(zip5)
            if (10001 <= zip_int <= 10282) or \
               (10451 <= zip_int <= 10475) or \
               (11004 <= zip_int <= 11697) or \
               (10301 <= zip_int <= 10314):
                return zip5

        return None

    def _standardize_addresses(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Standardize address formats

        Args:
            df: DataFrame with address columns

        Returns:
            DataFrame with standardized addresses
        """

        # Create full address field
        df['full_address'] = (
            df['building'].astype(str).str.strip() + ' ' +
            df['street'].astype(str).str.strip() + ', ' +
            df['boro'].astype(str).str.strip() + ', NY ' +
            df['zipcode'].astype(str).str.strip()
        )

        # Standardize street suffixes
        street_suffix_map = {
            r'\bAVE\b': 'Avenue',
            r'\bAV\b': 'Avenue',
            r'\bST\b': 'Street',
            r'\bRD\b': 'Road',
            r'\bBLVD\b': 'Boulevard',
            r'\bPKWY\b': 'Parkway',
            r'\bPL\b': 'Place',
            r'\bDR\b': 'Drive',
            r'\bCT\b': 'Court',
            r'\bLN\b': 'Lane',
            r'\bTER\b': 'Terrace',
        }

        for pattern, replacement in street_suffix_map.items():
            df['street'] = df['street'].str.replace(
                pattern,
                replacement,
                regex=True,
                case=False
            )

        # Standardize directional prefixes
        df['street'] = df['street'].str.replace(r'\bN\b', 'North', regex=True, case=False)
        df['street'] = df['street'].str.replace(r'\bS\b', 'South', regex=True, case=False)
        df['street'] = df['street'].str.replace(r'\bE\b', 'East', regex=True, case=False)
        df['street'] = df['street'].str.replace(r'\bW\b', 'West', regex=True, case=False)

        return df

    def calculate_completeness_score(self, df: pd.DataFrame) -> Dict[str, float]:
        """
        Calculate data completeness for each field

        Args:
            df: DataFrame to analyze

        Returns:
            Dictionary mapping field names to completeness scores (0-1)
        """

        completeness = {}

        for col in df.columns:
            non_null = df[col].notna().sum()
            completeness[col] = non_null / len(df) if len(df) > 0 else 0.0

        return completeness

    def identify_anomalies(self, df: pd.DataFrame, column: str) -> List[any]:
        """
        Identify statistical anomalies in numeric columns

        Args:
            df: DataFrame
            column: Column name to check

        Returns:
            List of anomalous values
        """

        if column not in df.columns or not pd.api.types.is_numeric_dtype(df[column]):
            return []

        # Use IQR method to detect outliers
        Q1 = df[column].quantile(0.25)
        Q3 = df[column].quantile(0.75)
        IQR = Q3 - Q1

        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR

        anomalies = df[
            (df[column] < lower_bound) | (df[column] > upper_bound)
        ][column].tolist()

        return anomalies


class DataEnrichmentEngine:
    """
    Enrich data with additional computed fields and external sources
    """

    def __init__(self):
        self.geocoding_cache = {}

    def enrich_establishments(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Enrich establishment data with additional fields

        Args:
            df: Establishment DataFrame

        Returns:
            Enriched DataFrame
        """

        # Geocode addresses (if not already geocoded)
        if 'latitude' not in df.columns or df['latitude'].isna().any():
            df = self._geocode_addresses(df)

        # Add derived fields
        df['has_contact_info'] = (df['phone'].notna() | df['email'].notna())
        df['address_quality_score'] = df.apply(self._calculate_address_quality, axis=1)

        return df

    def _geocode_addresses(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Geocode addresses to get lat/lon

        Note: In production, would use NYC Geoclient API or similar

        Args:
            df: DataFrame with address fields

        Returns:
            DataFrame with latitude and longitude
        """

        # Placeholder - would integrate with geocoding service
        if 'full_address' not in df.columns:
            return df

        # Add placeholder coordinates
        df['latitude'] = None
        df['longitude'] = None

        logger.info("Geocoding addresses (placeholder - integrate with NYC Geoclient API)")

        return df

    def _calculate_address_quality(self, row: pd.Series) -> float:
        """
        Calculate address data quality score

        Args:
            row: DataFrame row

        Returns:
            Quality score 0-1
        """

        score = 0.0

        if pd.notna(row.get('building')):
            score += 0.2
        if pd.notna(row.get('street')):
            score += 0.2
        if pd.notna(row.get('boro')):
            score += 0.2
        if pd.notna(row.get('zipcode')):
            score += 0.2
        if pd.notna(row.get('latitude')) and pd.notna(row.get('longitude')):
            score += 0.2

        return score
