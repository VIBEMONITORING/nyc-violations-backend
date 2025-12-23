# Luxury Watch Pricing Intelligence Engine

A comprehensive marketplace intelligence platform for luxury watches that scrapes data from multiple marketplaces, analyzes price trends, parses messaging-based listings, and provides actionable insights through dashboards and alerts.

## 🎯 Features

### 1. **Marketplace Data Collection**
- **Chrono24 Scraper**: Automated scraping with filters for year, condition, seller trust score, and region
- **eBay Scraper**: Parallel scraping with intelligent pagination and rate limiting
- **Data Validation**: Robust parsing and normalization of product data
- **Historical Tracking**: Complete price history with timestamped snapshots

### 2. **Price Trend Analysis**
- **Statistical Analysis**: Floor, average, and ceiling price calculations
- **Trend Detection**: Identify increasing, decreasing, or stable price patterns
- **Volatility Metrics**: Coefficient of variation and price range analysis
- **Opportunity Detection**: Automated identification of underpriced listings
- **Confidence Scoring**: Data quality and reliability indicators

### 3. **Business Rules Engine**
- **Pricing Rules**: Dynamic margin calculation based on brand, condition, and market trends
- **Filter Rules**: Quality filtering for listings (seller trust, condition, year)
- **Opportunity Rules**: Configurable criteria for buying opportunities
- **Priority System**: Rule execution order and override logic

### 4. **Messaging-Based Listing Parser**
- **Multi-Platform Support**: WhatsApp, Telegram, Slack
- **Shorthand Format Parsing**: "42k usd", "€38,000", "£12.5k"
- **Smart Extraction**: Reference numbers, years, conditions, prices, currencies
- **Confidence Scoring**: Reliability assessment for parsed data
- **Batch Processing**: Handle multiple listings in a single message

### 5. **Internal Dashboards**
- **Streamlit Interface**: Interactive, user-friendly web dashboard
- **Advanced Filtering**: By brand, reference, price, condition, seller, marketplace
- **Price History Visualization**: Interactive charts with trend lines
- **Opportunity Browser**: Real-time buying opportunities
- **Message Parser UI**: Parse and save listings from chat messages
- **Data Export**: CSV download for offline analysis

### 6. **Alert System**
- **Slack Notifications**: Rich formatted messages with action buttons
- **Email Alerts**: HTML emails with detailed information
- **Alert Types**: Price drops, below threshold, buying opportunities
- **Configurable Triggers**: Custom thresholds and conditions
- **Alert History**: Track all triggered alerts

### 7. **Automation & Scheduling**
- **Automated Scraping**: Scheduled scraping every 6 hours
- **Price Analysis**: Hourly price trend analysis
- **Alert Monitoring**: Check alerts every 15 minutes
- **Daily Digest**: Morning opportunity summary
- **Data Cleanup**: Weekly maintenance tasks

## 🚀 Quick Start

### Using Docker (Recommended)

1. **Clone and configure**
```bash
git clone <repository-url>
cd nyc-violations-backend
cp .env.example .env
# Edit .env with your configuration
```

2. **Start all services**
```bash
docker-compose up -d
```

3. **Access the services**
- **Dashboard**: http://localhost:8501
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

### Local Development

See detailed setup instructions in [ARCHITECTURE.md](ARCHITECTURE.md)

## 📖 Usage Examples

### Scraping Watches
```python
from python_backend.scrapers.chrono24_scraper import Chrono24Scraper
import asyncio

scraper = Chrono24Scraper()
listings = asyncio.run(scraper.scrape_watch(
    reference_number='116500LN',
    brand='Rolex',
    filters={'min_year': 2020, 'condition': 'new'}
))
```

### Price Analysis
```python
from python_backend.analytics.price_analyzer import PriceAnalyzer
from python_backend.database.db import get_db_context

with get_db_context() as db:
    analyzer = PriceAnalyzer(db)
    analysis = analyzer.analyze_watch_pricing(watch_id=1, days_back=30)
    print(f"Recommendation: {analysis['recommendation']}")
```

### Message Parsing
```python
from python_backend.parsers.message_parser import MessageParser

parser = MessageParser()
message = "Rolex 116500LN 2023 new 42k usd box papers"
listings = parser.parse_message(message)
```

## 📊 Key Components

- **Python Backend**: Scraping, analysis, and automation
- **PostgreSQL**: Data storage with optimized schema
- **Redis**: Task queue and caching
- **FastAPI**: REST API for data access
- **Streamlit**: Interactive dashboard
- **Celery**: Background task processing
- **Playwright**: Modern web scraping

## 🔧 Configuration

Key settings in `.env`:
- `DATABASE_URL`: PostgreSQL connection
- `REDIS_URL`: Redis connection
- `SLACK_WEBHOOK_URL`: Slack notifications
- `SENDGRID_API_KEY`: Email notifications
- `MIN_SELLER_TRUST_SCORE`: Filter threshold
- `PRICE_OPPORTUNITY_THRESHOLD`: Alert threshold

## 📚 Documentation

- [Architecture](ARCHITECTURE.md) - System design and components
- [API Docs](http://localhost:8000/docs) - Interactive API documentation

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open Pull Request

## 📄 License

MIT License

---

**Built for luxury watch enthusiasts and dealers**