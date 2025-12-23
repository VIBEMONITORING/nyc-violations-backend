"""
Configuration Management for Luxury Watch Pricing Intelligence Engine
"""
import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application Settings"""

    # Application
    APP_NAME: str = "Luxury Watch Pricing Intelligence Engine"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = Field(default=False, env="DEBUG")
    ENVIRONMENT: str = Field(default="development", env="ENVIRONMENT")

    # Database
    DATABASE_URL: str = Field(
        default="postgresql://user:password@localhost:5432/watch_pricing",
        env="DATABASE_URL"
    )

    # Redis
    REDIS_URL: str = Field(default="redis://localhost:6379/0", env="REDIS_URL")
    REDIS_CACHE_TTL: int = Field(default=3600, env="REDIS_CACHE_TTL")  # 1 hour

    # Scraping Configuration
    SCRAPING_USER_AGENT: str = Field(
        default="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        env="SCRAPING_USER_AGENT"
    )
    SCRAPING_TIMEOUT: int = Field(default=30000, env="SCRAPING_TIMEOUT")  # milliseconds
    SCRAPING_MAX_RETRIES: int = Field(default=3, env="SCRAPING_MAX_RETRIES")
    SCRAPING_DELAY_MIN: float = Field(default=2.0, env="SCRAPING_DELAY_MIN")  # seconds
    SCRAPING_DELAY_MAX: float = Field(default=5.0, env="SCRAPING_DELAY_MAX")  # seconds

    # Proxy Configuration (optional)
    USE_PROXY: bool = Field(default=False, env="USE_PROXY")
    PROXY_URL: Optional[str] = Field(default=None, env="PROXY_URL")
    PROXY_ROTATION: bool = Field(default=False, env="PROXY_ROTATION")

    # Chrono24 Configuration
    CHRONO24_BASE_URL: str = "https://www.chrono24.com"
    CHRONO24_SEARCH_URL: str = "https://www.chrono24.com/search/index.htm"
    CHRONO24_MAX_PAGES: int = Field(default=10, env="CHRONO24_MAX_PAGES")

    # eBay Configuration
    EBAY_BASE_URL: str = "https://www.ebay.com"
    EBAY_API_KEY: Optional[str] = Field(default=None, env="EBAY_API_KEY")
    EBAY_MAX_RESULTS: int = Field(default=100, env="EBAY_MAX_RESULTS")

    # Currency Conversion
    CURRENCY_API_KEY: Optional[str] = Field(default=None, env="CURRENCY_API_KEY")
    CURRENCY_API_URL: str = "https://api.exchangerate-api.com/v4/latest/USD"
    BASE_CURRENCY: str = "USD"

    # Messaging Platforms
    WHATSAPP_WEB_ENABLED: bool = Field(default=False, env="WHATSAPP_WEB_ENABLED")
    TELEGRAM_BOT_TOKEN: Optional[str] = Field(default=None, env="TELEGRAM_BOT_TOKEN")
    SLACK_BOT_TOKEN: Optional[str] = Field(default=None, env="SLACK_BOT_TOKEN")

    # Alerts & Notifications
    SLACK_WEBHOOK_URL: Optional[str] = Field(default=None, env="SLACK_WEBHOOK_URL")
    SLACK_CHANNEL: str = Field(default="#price-alerts", env="SLACK_CHANNEL")

    SENDGRID_API_KEY: Optional[str] = Field(default=None, env="SENDGRID_API_KEY")
    EMAIL_FROM: str = Field(default="alerts@watchpricing.com", env="EMAIL_FROM")
    EMAIL_TO: List[str] = Field(default=[], env="EMAIL_TO")

    # Business Rules
    MIN_SELLER_TRUST_SCORE: float = Field(default=0.7, env="MIN_SELLER_TRUST_SCORE")
    MIN_DATA_POINTS_FOR_ANALYSIS: int = Field(default=5, env="MIN_DATA_POINTS_FOR_ANALYSIS")
    PRICE_OPPORTUNITY_THRESHOLD: float = Field(default=10.0, env="PRICE_OPPORTUNITY_THRESHOLD")  # percent
    DEFAULT_MARGIN_PERCENT: float = Field(default=20.0, env="DEFAULT_MARGIN_PERCENT")

    # Scheduling
    SCRAPING_SCHEDULE_CHRONO24: str = Field(default="0 */6 * * *", env="SCRAPING_SCHEDULE_CHRONO24")  # Every 6 hours
    SCRAPING_SCHEDULE_EBAY: str = Field(default="0 */6 * * *", env="SCRAPING_SCHEDULE_EBAY")
    PRICE_ANALYSIS_SCHEDULE: str = Field(default="0 */1 * * *", env="PRICE_ANALYSIS_SCHEDULE")  # Hourly
    ALERT_CHECK_SCHEDULE: str = Field(default="*/15 * * * *", env="ALERT_CHECK_SCHEDULE")  # Every 15 min

    # API Configuration
    API_HOST: str = Field(default="0.0.0.0", env="API_HOST")
    API_PORT: int = Field(default=8000, env="API_PORT")
    API_RELOAD: bool = Field(default=True, env="API_RELOAD")

    # JWT & Security
    JWT_SECRET_KEY: str = Field(default="change-me-in-production", env="JWT_SECRET_KEY")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Streamlit Dashboard
    STREAMLIT_PORT: int = Field(default=8501, env="STREAMLIT_PORT")
    STREAMLIT_SERVER_ADDRESS: str = Field(default="0.0.0.0", env="STREAMLIT_SERVER_ADDRESS")

    # Logging
    LOG_LEVEL: str = Field(default="INFO", env="LOG_LEVEL")
    LOG_FORMAT: str = "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>"

    # Data Retention
    PRICE_HISTORY_RETENTION_DAYS: int = Field(default=365, env="PRICE_HISTORY_RETENTION_DAYS")
    SCRAPING_JOBS_RETENTION_DAYS: int = Field(default=90, env="SCRAPING_JOBS_RETENTION_DAYS")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# Initialize settings
settings = Settings()


# Watch Condition Mapping
CONDITION_MAPPING = {
    "new": ["new", "unworn", "brand new", "bnib", "factory sealed"],
    "unworn": ["unworn", "mint", "never worn", "pristine"],
    "very-good": ["very good", "excellent", "like new", "99%"],
    "good": ["good", "good condition", "used"],
    "fair": ["fair", "worn", "vintage"],
}


# Marketplace Configuration
MARKETPLACE_CONFIG = {
    "chrono24": {
        "name": "Chrono24",
        "base_url": settings.CHRONO24_BASE_URL,
        "search_url": settings.CHRONO24_SEARCH_URL,
        "selectors": {
            "listing": "article.article-item",
            "title": ".article-item-title",
            "price": ".article-item-price",
            "seller": ".dealer-name",
            "condition": ".article-item-condition",
        }
    },
    "ebay": {
        "name": "eBay",
        "base_url": settings.EBAY_BASE_URL,
        "search_url": f"{settings.EBAY_BASE_URL}/sch/i.html",
        "selectors": {
            "listing": ".s-item",
            "title": ".s-item__title",
            "price": ".s-item__price",
            "seller": ".s-item__seller-info-text",
            "condition": ".SECONDARY_INFO",
        }
    }
}


# Currency Symbols
CURRENCY_SYMBOLS = {
    "USD": "$",
    "EUR": "€",
    "GBP": "£",
    "JPY": "¥",
    "CHF": "CHF",
    "AUD": "A$",
    "CAD": "C$",
    "HKD": "HK$",
    "SGD": "S$",
}


# Popular Watch Brands
POPULAR_BRANDS = [
    "Rolex",
    "Patek Philippe",
    "Audemars Piguet",
    "Omega",
    "TAG Heuer",
    "Breitling",
    "IWC",
    "Cartier",
    "Jaeger-LeCoultre",
    "Panerai",
    "Hublot",
    "Richard Mille",
    "A. Lange & Söhne",
    "Vacheron Constantin",
    "Tudor",
    "Grand Seiko",
    "Zenith",
    "Chopard",
    "Blancpain",
    "Glashutte Original",
]
