# Luxury Watch Pricing Intelligence Engine - Architecture

## System Overview

A comprehensive marketplace intelligence platform for luxury watches that scrapes data from multiple marketplaces, analyzes price trends, parses messaging-based listings, and provides actionable insights through dashboards and alerts.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA COLLECTION LAYER                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  Chrono24    │    │    eBay      │    │  WhatsApp    │      │
│  │   Scraper    │    │   Scraper    │    │   Parser     │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                    │                    │              │
│         └────────────────────┴────────────────────┘              │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA PROCESSING LAYER                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ Data Cleaner │    │  Normalizer  │    │  Validator   │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         └────────────────────┴────────────────────┘              │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                         DATA STORAGE LAYER                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              PostgreSQL Database                      │       │
│  │                                                        │       │
│  │  • watches (SKU, brand, model, reference)            │       │
│  │  • price_history (timestamped price data)            │       │
│  │  • marketplace_listings (current listings)           │       │
│  │  • sellers (seller trust scores, regions)            │       │
│  │  • parsed_messages (WhatsApp/messaging data)         │       │
│  │  • price_alerts (alert configurations)               │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ANALYTICS & RULES LAYER                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ Price Trend  │    │  Business    │    │  Opportunity │      │
│  │  Analysis    │    │  Rules Eng.  │    │  Detector    │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API & INTERFACE LAYER                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  REST API    │    │  Streamlit   │    │ Alert System │      │
│  │  (Express)   │    │  Dashboard   │    │ (Slack/Email)│      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Data Collection Layer

#### Chrono24 Scraper
- **Technology**: Python with Playwright
- **Features**:
  - Scrape floor prices by SKU
  - Filter by year, condition, seller trust score, region
  - Handle pagination and dynamic content
  - Respect rate limits and implement rotating proxies

#### eBay Scraper
- **Technology**: Python with Playwright/Selenium
- **Features**:
  - Search luxury watch listings
  - Extract price, condition, seller ratings
  - Filter by year and region
  - Handle eBay's authentication

#### WhatsApp Parser
- **Technology**: Python with regex and NLP
- **Features**:
  - Parse shorthand formats ("42k usd", "€38,000")
  - Extract reference numbers, years, conditions
  - Normalize currency and price formats
  - Handle various input formats

### 2. Data Processing Layer

- **Data Cleaner**: Remove duplicates, invalid entries
- **Normalizer**: Standardize currencies, conditions, references
- **Validator**: Ensure data quality and completeness

### 3. Data Storage Layer

**PostgreSQL Database Schema**:
- Relational data for watches, prices, sellers
- Time-series data for price history
- Indexing for fast queries
- Partitioning for large datasets

### 4. Analytics & Rules Layer

#### Price Trend Analysis
- Calculate moving averages
- Detect price deltas and anomalies
- Identify buying opportunities
- Generate repricing suggestions

#### Business Rules Engine
- Margin calculation formulas
- Pricing strategy rules
- Inventory optimization logic
- Custom business logic

### 5. API & Interface Layer

#### REST API (Node.js/Express)
- CRUD operations for all entities
- Query endpoints with filtering
- Authentication and authorization
- Rate limiting

#### Streamlit Dashboard
- Interactive filtering by reference, price, condition
- Price trend visualizations
- Seller analytics
- Export functionality

#### Alert System
- Slack notifications for price drops
- Email alerts for opportunities
- Configurable triggers
- Alert history tracking

## Technology Stack

### Backend
- **Python 3.11+**: Scraping, data processing, analytics
- **Node.js/Express**: REST API
- **PostgreSQL**: Primary database
- **Redis**: Caching and job queues

### Scraping & Automation
- **Playwright**: Modern web scraping
- **BeautifulSoup4**: HTML parsing
- **Selenium**: Fallback for complex sites

### Data Processing
- **Pandas**: Data manipulation
- **NumPy**: Numerical computations
- **Pydantic**: Data validation

### Dashboard & UI
- **Streamlit**: Internal dashboards
- **Plotly**: Interactive charts
- **React** (optional): Advanced UI

### DevOps & Automation
- **Celery**: Task scheduling
- **Docker**: Containerization
- **GitHub Actions**: CI/CD

## Data Flow

1. **Collection**: Scrapers run on schedule (hourly/daily)
2. **Processing**: Data cleaned and normalized
3. **Storage**: Saved to PostgreSQL with timestamps
4. **Analysis**: Trends calculated, rules applied
5. **Alerts**: Triggers evaluated, notifications sent
6. **Access**: Data available via API and dashboards

## Key Features

### Price Intelligence
- Real-time floor price tracking
- Historical price analysis
- Price delta detection
- Competitive positioning

### Messaging Parser
- WhatsApp Web integration
- Multi-format parsing
- Automatic data extraction
- Structured data output

### Business Rules
- Dynamic pricing formulas
- Margin optimization
- Inventory valuation
- Repricing automation

### Dashboards
- Real-time data visualization
- Advanced filtering
- Export capabilities
- Custom alerts

## Security & Compliance

- API authentication (JWT)
- Role-based access control
- Data encryption at rest
- Secure scraping practices
- GDPR compliance for user data

## Scalability

- Horizontal scaling with Docker
- Database read replicas
- Caching layer with Redis
- Asynchronous job processing
- Load balancing

## Future Enhancements

1. **Predictive Pricing**: ML models for price forecasting
2. **SEO Optimization**: Auto-generate optimized listings
3. **Multi-Platform**: Add more marketplaces
4. **Mobile App**: Native mobile experience
5. **API Marketplace**: Public API for partners
