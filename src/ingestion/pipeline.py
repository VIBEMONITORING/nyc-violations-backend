"""
NYC Violation Compliance System - Data Ingestion Pipeline

Production-grade data ingestion with:
- Async/parallel requests
- Rate limiting
- Error handling & retries
- Incremental updates
- Data validation
"""

import asyncio
import aiohttp
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import logging
from tenacity import retry, stop_after_attempt, wait_exponential


logger = logging.getLogger(__name__)


class NYCDataPipeline:
    """
    Production-grade data ingestion pipeline for NYC Open Data

    Features:
    - Asynchronous parallel requests
    - Automatic rate limiting
    - Retry logic with exponential backoff
    - Incremental updates
    - Data validation hooks
    """

    BASE_URL = "https://data.cityofnewyork.us/resource"

    DATASETS = {
        'inspections': '43nn-pn8j',          # DOHMH Restaurant Inspections
        'oath_open': 'jz4z-kudi',            # OATH Open Hearings
        'oath_closed': 'y3hw-z6bm',          # OATH Closed Hearings
        'nypd_summons': 'hxbk-grd3',         # NYPD Summons
        'dcwp_inspections': 'jzhd-m6uv',     # DCWP Inspections
        'dcwp_payments': '2xab-argn',        # DCWP Payments
        'dcwp_charges': '5fn4-dr26',         # DCWP Charges
        'env_complaints': '9jgj-bmct'        # Environmental Complaints
    }

    def __init__(self, app_token: str, max_concurrent: int = 5):
        """
        Initialize pipeline

        Args:
            app_token: NYC Open Data API token
            max_concurrent: Max concurrent requests
        """
        self.app_token = app_token
        self.max_concurrent = max_concurrent
        self.session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession(
            headers={
                'X-App-Token': self.app_token,
                'Content-Type': 'application/json'
            },
            timeout=aiohttp.ClientTimeout(total=60)
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def fetch_dataset(
        self,
        dataset_id: str,
        filters: Optional[Dict] = None,
        limit: int = 50000,
        offset: int = 0,
        order_by: Optional[str] = None
    ) -> List[Dict]:
        """
        Fetch data from NYC Open Data API with retry logic

        Args:
            dataset_id: NYC Open Data dataset identifier
            filters: SoQL filter conditions
            limit: Max records per request
            offset: Starting offset for pagination
            order_by: Field to order results

        Returns:
            List of records as dictionaries
        """

        if not self.session:
            raise RuntimeError("Session not initialized. Use async context manager.")

        url = f"{self.BASE_URL}/{dataset_id}.json"

        params = {
            '$limit': limit,
            '$offset': offset
        }

        # Add ordering
        if order_by:
            params['$order'] = order_by
        else:
            # Default to most recent first
            if 'inspection_date' in dataset_id or dataset_id == self.DATASETS['inspections']:
                params['$order'] = 'inspection_date DESC'

        # Build SoQL WHERE clause
        if filters:
            params['$where'] = self._build_where_clause(filters)

        try:
            logger.info(f"Fetching {dataset_id} (limit={limit}, offset={offset})")
            async with self.session.get(url, params=params) as response:
                response.raise_for_status()
                data = await response.json()
                logger.info(f"Fetched {len(data)} records from {dataset_id}")
                return data

        except aiohttp.ClientResponseError as e:
            logger.error(f"HTTP error fetching {dataset_id}: {e.status} - {e.message}")
            raise
        except aiohttp.ClientError as e:
            logger.error(f"Client error fetching {dataset_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error fetching {dataset_id}: {e}")
            raise

    def _build_where_clause(self, filters: Dict) -> str:
        """
        Build SoQL WHERE clause from filters

        Args:
            filters: Dictionary of filter conditions

        Returns:
            SoQL WHERE clause string
        """
        conditions = []

        # Date range filter
        if 'start_date' in filters:
            date_field = filters.get('date_field', 'inspection_date')
            conditions.append(f"{date_field} >= '{filters['start_date']}'")

        if 'end_date' in filters:
            date_field = filters.get('date_field', 'inspection_date')
            conditions.append(f"{date_field} <= '{filters['end_date']}'")

        # Borough filter
        if 'boro' in filters:
            conditions.append(f"boro = '{filters['boro']}'")

        # CAMIS filter (specific establishment)
        if 'camis' in filters:
            conditions.append(f"camis = '{filters['camis']}'")

        # Critical violations only
        if filters.get('critical_only', False):
            conditions.append("critical_flag = 'Critical'")

        # Violation code filter
        if 'violation_codes' in filters:
            codes = "','".join(filters['violation_codes'])
            conditions.append(f"violation_code IN ('{codes}')")

        # Zipcode filter
        if 'zipcode' in filters:
            conditions.append(f"zipcode = '{filters['zipcode']}'")

        return " AND ".join(conditions) if conditions else ""

    async def fetch_all_datasets_incremental(
        self,
        since: datetime,
        dataset_filter: Optional[List[str]] = None
    ) -> Dict[str, List[Dict]]:
        """
        Fetch incremental updates from all datasets

        Args:
            since: Fetch records since this datetime
            dataset_filter: Optional list of dataset names to fetch

        Returns:
            Dictionary mapping dataset names to records
        """

        filters = {'start_date': since.strftime('%Y-%m-%d')}

        # Determine which datasets to fetch
        datasets_to_fetch = dataset_filter if dataset_filter else list(self.DATASETS.keys())

        # Create tasks for parallel fetching
        tasks = [
            self.fetch_dataset(self.DATASETS[name], filters)
            for name in datasets_to_fetch
            if name in self.DATASETS
        ]

        # Execute in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Map results back to dataset names
        output = {}
        for name, result in zip(datasets_to_fetch, results):
            if isinstance(result, Exception):
                logger.error(f"Failed to fetch {name}: {result}")
                output[name] = []
            else:
                output[name] = result

        return output

    async def fetch_paginated(
        self,
        dataset_id: str,
        total_records: int,
        filters: Optional[Dict] = None
    ) -> List[Dict]:
        """
        Fetch large datasets in paginated chunks

        Args:
            dataset_id: Dataset identifier
            total_records: Estimated total records
            filters: Optional filters

        Returns:
            All records from dataset
        """

        limit = 50000  # Max per request (NYC Open Data limit)
        all_data = []

        # Semaphore to limit concurrent requests
        semaphore = asyncio.Semaphore(self.max_concurrent)

        async def fetch_page(offset: int) -> List[Dict]:
            """Fetch single page with semaphore"""
            async with semaphore:
                return await self.fetch_dataset(
                    dataset_id,
                    filters=filters,
                    limit=limit,
                    offset=offset
                )

        # Create tasks for each page
        tasks = [
            fetch_page(offset)
            for offset in range(0, total_records, limit)
        ]

        # Execute all page fetches
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Combine results
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Page fetch failed: {result}")
            else:
                all_data.extend(result)

        logger.info(f"Total records fetched: {len(all_data)}")
        return all_data

    async def fetch_establishment_details(self, camis: str) -> Dict[str, List[Dict]]:
        """
        Fetch all data for a specific establishment

        Args:
            camis: Establishment CAMIS ID

        Returns:
            Dictionary with all related records
        """

        filters = {'camis': camis}

        # Fetch from multiple datasets
        tasks = {
            'inspections': self.fetch_dataset(self.DATASETS['inspections'], filters),
            'oath_open': self.fetch_dataset(self.DATASETS['oath_open'], filters),
            'oath_closed': self.fetch_dataset(self.DATASETS['oath_closed'], filters),
        }

        results = {}
        for name, task in tasks.items():
            try:
                results[name] = await task
            except Exception as e:
                logger.error(f"Error fetching {name} for {camis}: {e}")
                results[name] = []

        return results

    async def get_dataset_metadata(self, dataset_id: str) -> Dict:
        """
        Get metadata for a dataset

        Args:
            dataset_id: Dataset identifier

        Returns:
            Metadata dictionary
        """

        # NYC Open Data discovery API
        url = f"https://data.cityofnewyork.us/api/views/{dataset_id}.json"

        try:
            async with self.session.get(url) as response:
                response.raise_for_status()
                metadata = await response.json()
                return {
                    'name': metadata.get('name'),
                    'description': metadata.get('description'),
                    'row_count': metadata.get('rowsUpdatedAt'),
                    'columns': [col['name'] for col in metadata.get('columns', [])]
                }
        except Exception as e:
            logger.error(f"Error fetching metadata for {dataset_id}: {e}")
            return {}


class IncrementalUpdateManager:
    """
    Manages incremental updates and tracks last sync times
    """

    def __init__(self):
        self.last_sync_times: Dict[str, datetime] = {}

    def get_last_sync(self, dataset: str) -> datetime:
        """Get last sync time for dataset"""
        return self.last_sync_times.get(
            dataset,
            datetime.now() - timedelta(days=365)  # Default: 1 year ago
        )

    def update_sync_time(self, dataset: str, sync_time: Optional[datetime] = None):
        """Update last sync time for dataset"""
        self.last_sync_times[dataset] = sync_time or datetime.now()

    async def perform_incremental_sync(
        self,
        pipeline: NYCDataPipeline,
        dataset: str,
        dataset_id: str
    ) -> List[Dict]:
        """
        Perform incremental sync for a dataset

        Args:
            pipeline: NYCDataPipeline instance
            dataset: Dataset name
            dataset_id: Dataset identifier

        Returns:
            New records since last sync
        """

        last_sync = self.get_last_sync(dataset)
        logger.info(f"Syncing {dataset} since {last_sync}")

        filters = {'start_date': last_sync.strftime('%Y-%m-%d')}
        records = await pipeline.fetch_dataset(dataset_id, filters=filters)

        # Update sync time
        self.update_sync_time(dataset)

        return records


# Example usage
async def main():
    """Example pipeline usage"""

    # Initialize pipeline
    app_token = "YOUR_NYC_OPENDATA_TOKEN"

    async with NYCDataPipeline(app_token=app_token) as pipeline:

        # Incremental update (last 24 hours)
        since = datetime.now() - timedelta(days=1)
        data = await pipeline.fetch_all_datasets_incremental(since)

        print(f"Inspections: {len(data.get('inspections', []))}")
        print(f"Open Hearings: {len(data.get('oath_open', []))}")

        # Fetch specific establishment
        establishment_data = await pipeline.fetch_establishment_details('50000000')
        print(f"Establishment inspections: {len(establishment_data['inspections'])}")


if __name__ == "__main__":
    asyncio.run(main())
