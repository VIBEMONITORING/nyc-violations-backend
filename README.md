# I&M Opportunity Scanner System

A comprehensive web scraping and analysis system that monitors government procurement sites, construction industry boards, and transit authority RFPs to identify Inspection & Monitoring (I&M) opportunities.

## Features

### 1. Multi-Source Web Scraping
- **SAM.gov** - Federal government procurement opportunities
- **State DOT Sites** - State Department of Transportation projects (NY, NJ, CT, PA)
- **Construction Industry Boards** - Industry-specific opportunities
- **Transit Authority RFPs** - Public transportation project opportunities

### 2. Intelligent Filtering
Automatically filters opportunities based on:
- Project value (minimum $100,000)
- Monitoring duration (minimum 3 months)
- Geographic proximity (within 100 miles of base location)
- Technical requirements match (I&M-related keywords)

### 3. Advanced Scoring Algorithm (1-10 scale)
Each opportunity is scored based on:
- **Profit Margin Potential** (35% weight) - Project value, duration, and distance
- **Resource Availability** (25% weight) - Current capacity and staffing requirements
- **Competition Level** (25% weight) - Specialization, project size, location factors
- **Client Relationship** (15% weight) - Existing relationships and client type

### 4. Automated Reporting
- Weekly opportunity reports with top 10 opportunities
- Bid/no-bid recommendations
- Estimated revenue potential
- Required resources breakdown
- Email notifications for high-priority opportunities (score ≥ 8)

### 5. RESTful API & Dashboard
- Complete API for opportunity management
- Real-time dashboard with statistics and charts
- Manual trigger options for scanning and reporting
- Scraping activity logs

## Installation

### Prerequisites
- Node.js 18.x or higher
- PostgreSQL database
- SMTP server access (for email notifications)

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd nyc-violations-backend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
npm run setup-db
```

5. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## Configuration

### Environment Variables

#### Database
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/opportunity_scanner
```

#### Email/SMTP
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
REPORT_RECIPIENTS=recipient1@company.com,recipient2@company.com
```

#### SAM.gov API
Register for a free API key at [sam.gov](https://sam.gov/):
```env
SAM_GOV_API_KEY=your_api_key_here
```

#### Filter Settings
```env
MIN_PROJECT_VALUE=100000
MIN_MONITORING_DURATION=3
MAX_DISTANCE_MILES=100
BASE_LATITUDE=40.7128
BASE_LONGITUDE=-74.0060
```

#### Scoring Settings
```env
AVG_MARGIN_RATE=0.25
RESOURCE_UTILIZATION=0.70
KNOWN_CLIENTS=DOT,MTA,Port Authority
```

## API Endpoints

### Opportunities
- `GET /api/opportunities` - Get all opportunities (with filters)
- `GET /api/opportunities/top` - Get top-scored opportunities
- `GET /api/opportunities/:id` - Get opportunity by ID
- `PUT /api/opportunities/:id/status` - Update opportunity status
- `POST /api/opportunities/scan` - Trigger opportunity scan
- `GET /api/opportunities/stats/summary` - Get statistics

### Reports
- `GET /api/reports/weekly` - Get weekly reports
- `GET /api/reports/weekly/latest` - Get latest weekly report
- `GET /api/reports/logs` - Get scraping logs

### Scheduler
- `GET /api/scheduler/status` - Get scheduler status
- `POST /api/scheduler/trigger/scan` - Manually trigger scan
- `POST /api/scheduler/trigger/report` - Manually trigger weekly report
- `POST /api/scheduler/trigger/alerts` - Manually trigger alerts

### Dashboard
- `GET /api/dashboard` - Get dashboard overview
- `GET /api/dashboard/charts/timeline` - Get timeline chart data
- `GET /api/dashboard/charts/revenue` - Get revenue chart data

## Scheduled Jobs

The system runs three automated jobs:

1. **Daily Scraping** - 6:00 AM daily
   - Scrapes all configured sources
   - Filters and scores new opportunities
   - Saves to database

2. **High-Priority Alerts** - Every 4 hours
   - Checks for opportunities scored 8 or higher
   - Sends email alerts to recipients

3. **Weekly Report** - Monday 8:00 AM
   - Generates comprehensive weekly summary
   - Emails top 10 opportunities
   - Includes bid/no-bid recommendations

## Opportunity Status Workflow

Opportunities progress through these statuses:
- `new` - Newly discovered opportunity
- `reviewing` - Under review by team
- `bidding` - Actively preparing bid
- `won` - Bid won
- `lost` - Bid lost
- `passed` - Decided not to bid

## Scoring Breakdown

### Profit Margin Score (1-10)
- Project value: $1M+ = +3, $500K+ = +2, $250K+ = +1
- Duration: 6-18 months = +2, 18-36 months = +1
- Distance: ≤25 miles = +1, >75 miles = -1

### Resource Availability Score (1-10)
- Duration: ≤6 months = +2, >12 months = -1
- Capacity: >40% available = +2, <15% available = -2
- Complexity: ≤2 requirements = +1, >5 requirements = -1

### Competition Score (1-10)
- Specialized requirements = +2
- Remote location (>60 miles) = +2
- Short deadline (<14 days) = +2
- Small project (<$300K) = +1

### Client Relationship Score (1-10)
- Known client = +4
- Government agency = +1
- DOT/Transportation = +1

## Database Schema

### Tables
- `opportunities` - Core opportunity data
- `opportunity_scores` - Scoring results
- `weekly_reports` - Generated reports
- `scraping_logs` - Scraping activity logs

## Development

### Project Structure
```
src/
├── config/         # Configuration (database, logger)
├── models/         # Database models
├── routes/         # API routes
├── scrapers/       # Web scraping modules
├── services/       # Business logic
├── scripts/        # Setup scripts
└── utils/          # Utilities (scheduler, helpers)
```

### Adding New Scrapers

1. Create a new scraper extending `BaseScraper`:
```javascript
const BaseScraper = require('./BaseScraper');

class CustomScraper extends BaseScraper {
  constructor() {
    super('Custom Source', { /* config */ });
  }

  async scrape() {
    // Implementation
  }
}

module.exports = CustomScraper;
```

2. Register in `src/scrapers/index.js`:
```javascript
this.scrapers = [
  new SamGovScraper(),
  new CustomScraper(),
  // ...
];
```

### Customizing Scoring

Edit `src/services/OpportunityScorer.js` to adjust:
- Scoring weights
- Individual scoring algorithms
- Recommended action thresholds

## Monitoring & Logs

Logs are stored in the `logs/` directory:
- `combined.log` - All log messages
- `error.log` - Error messages only

Console output includes:
- API requests
- Scraping activity
- Scheduled job execution
- Errors and warnings

## Troubleshooting

### Email notifications not working
- Check SMTP credentials in `.env`
- For Gmail, use App Password (not regular password)
- Verify `REPORT_RECIPIENTS` is configured

### Scraping returns no results
- Check if API keys are configured (SAM.gov)
- Verify network connectivity to target sites
- Check `scraping_logs` table for errors
- Some sites may require updated selectors

### Database connection errors
- Verify PostgreSQL is running
- Check `DATABASE_URL` in `.env`
- Ensure database exists and is accessible

## License

MIT

## Support

For issues and questions, please contact your system administrator.