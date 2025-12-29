# Construction Risk Radar

A comprehensive tool for assessing construction-related risks for real estate portfolios using NYC Department of Buildings (DOB) datasets.

## Overview

Construction Risk Radar integrates multiple NYC Open Data sources to provide quantitative risk assessment for properties identified by Borough-Block-Lot (BBL) or Building Identification Number (BIN).

## Data Sources

| Dataset | ID | Description |
|---------|-----|-------------|
| [DOB NOW: Build – Approved Permits](https://data.cityofnewyork.us/Housing-Development/DOB-NOW-Build-Approved-Permits/rbx6-tga4) | rbx6-tga4 | Approved construction permits (excludes Electrical, Elevator, LAA) |
| [DOB Violations (Active)](https://data.cityofnewyork.us/Housing-Development/DOB-Violations-Active-/cepu-5g8r) | cepu-5g8r | Active violations issued by DOB |
| [DOB ECB Violations](https://data.cityofnewyork.us/Housing-Development/DOB-ECB-Violations/6bgk-3dad) | 6bgk-3dad | Summonses adjudicated by OATH/ECB |

## Risk Scoring Methodology

### Overall Risk Score (0-100)

The risk score is calculated using a weighted combination of violation and permit factors:

```
Overall Score = (Violations Score × 0.60) + (Permits Score × 0.40)
```

### Violation Score Components

| Component | Weight | Description |
|-----------|--------|-------------|
| DOB Violations | 35% | Based on count and severity of active DOB violations |
| ECB Violations | 35% | Based on count, severity, and outstanding penalties |
| Violation Age | 15% | Recent violations (< 90 days) increase risk |
| Repeat Violations | 15% | Pattern of same violation types increases risk |

#### Severity Classifications

**DOB Violation Severity Levels:**
| Level | Types | Weight |
|-------|-------|--------|
| 5 (Critical) | AEUHAZ1, AEUHAZ2, EGNCY, UB (Unsafe Building), VCAT4 | 5x |
| 4 (High) | CMQ, E (Elevator), HBLVIO | 4x |
| 3 (Moderate) | B (Boiler), C (Construction), LBLVIO, LL11, LL26 | 3x |
| 2 (Low) | AEUAMEND, HVIOAM, P (Plumbing), VCAT2 | 2x |
| 1 (Minor) | V-DOB VIOLATION, VCAT1 | 1x |

**ECB Severity Levels:**
| Level | Classification | Typical Fine Range |
|-------|---------------|-------------------|
| 5 | IMMEDIATELY HAZARDOUS, HAZARDOUS | $10,000 - $25,000 |
| 4 | AGGRAVATED II, MAJOR | $5,000 - $15,000 |
| 3 | AGGRAVATED I | $2,500 - $10,000 |
| 2 | MINOR, LESSER | $1,000 - $5,000 |
| 1 | NON-HAZARDOUS | $500 - $2,500 |

### Permit Score Components

| Component | Weight | Description |
|-----------|--------|-------------|
| Expired Permits | 40% | Number of permits past expiration date |
| Permit Age | 30% | Permits > 2 years old without completion |
| Incomplete Filings | 30% | Permits not marked as completed/signed-off |

### Risk Level Thresholds

| Level | Score Range | Action Required |
|-------|-------------|-----------------|
| LOW | 0-25 | Standard monitoring |
| MEDIUM | 26-50 | Enhanced monitoring, address within 90 days |
| HIGH | 51-75 | Priority remediation within 30 days |
| CRITICAL | 76-100 | Immediate action required |

## CSV Export Schema

### Portfolio Summary Export

| Field | Description |
|-------|-------------|
| Property Identifier | BBL or BIN |
| Address | Street address |
| Risk Score | Overall risk score (0-100) |
| Risk Level | LOW/MEDIUM/HIGH/CRITICAL |
| Total Violations | Combined DOB + ECB violations |
| DOB Violations | Active DOB violation count |
| ECB Violations | ECB violation count |
| Total Permits | Active permit count |
| Expired Permits | Expired permit count |
| Outstanding Penalties ($) | Total ECB penalties due |
| Primary Issue | Most significant risk factor |

### Violations Detail Export

| Field | Description |
|-------|-------------|
| Property Identifier | BBL or BIN |
| Property Address | Street address |
| Violation Type | DOB or ECB |
| Violation Number | Unique violation identifier |
| Issue Date | Date violation was issued |
| Violation Code | DOB/ECB infraction code |
| Description | Violation description |
| Severity | Severity classification |
| Status | Current violation status |
| Penalty Imposed ($) | ECB penalty amount |
| Amount Due ($) | Outstanding balance |
| ECB Number | ECB reference number |
| Disposition Date | Resolution date (if applicable) |
| Property Risk Score | Overall property risk score |

### Permits Detail Export

| Field | Description |
|-------|-------------|
| Property Identifier | BBL or BIN |
| Property Address | Street address |
| Job Filing Number | DOB job filing number |
| Work Permit | Permit number |
| Work Type | Type of construction work |
| Filing Reason | Reason for permit application |
| Approved Date | Date permit was approved |
| Issued Date | Date permit was issued |
| Expired Date | Permit expiration date |
| Permit Status | Current status |
| Is Expired | Yes/No |
| Age (Days) | Days since issuance |
| Estimated Job Cost ($) | Estimated construction cost |
| Job Description | Description of work |
| Owner Name | Property owner |
| Applicant Name | Permit applicant |
| Property Risk Score | Overall property risk score |

## Dashboard Features

### Overview Panel
- Portfolio risk score gauge (0-100)
- Risk level distribution pie chart
- Total violation count with DOB/ECB breakdown
- Outstanding penalties summary
- Property count by risk level

### Trend Analysis
- 12-month violation trend line chart
- Permit activity timeline
- Risk score changes over time

### Property Rankings
- Top 10 highest-risk properties
- Properties with recent violations (< 90 days)
- Properties with significant penalties (> $10,000)

### Interactive Map
- Geospatial visualization of portfolio
- Color-coded by risk level
- Click for property details

### Alert Center
- Critical violations requiring immediate attention
- Newly issued violations
- Upcoming permit expirations
- Scheduled hearing dates

## Subscription Tiers

### Basic ($49/month)
- Up to 10 properties
- Weekly analysis refresh
- CSV exports
- Email support
- 3 months historical data

### Professional ($199/month)
- Up to 50 properties
- Daily analysis refresh
- CSV exports
- Dashboard access
- API access
- Email alerts
- Priority support
- 12 months historical data

### Enterprise ($499/month)
- Up to 500 properties
- Real-time monitoring
- All exports and dashboard features
- Full API access
- Custom integrations
- White-label options
- Dedicated support
- 36 months historical data

## API Endpoints

### Property Analysis

```http
POST /api/risk-radar/analyze
Content-Type: application/json

{
  "identifier": "1000010001"  // BBL or BIN
}
```

### Portfolio Analysis

```http
POST /api/risk-radar/portfolio/analyze
Content-Type: application/json

{
  "properties": ["1000010001", "1000010002", "1234567"],
  "options": {}
}
```

### Export Portfolio

```http
POST /api/risk-radar/portfolio/export
Content-Type: application/json

{
  "properties": ["1000010001", "1000010002"],
  "exportTypes": ["summary", "violations", "permits", "recommendations"]
}
```

### Dashboard Data

```http
POST /api/risk-radar/dashboard/overview
Content-Type: application/json

{
  "properties": ["1000010001", "1000010002"]
}
```

### Subscription Management

```http
GET /api/risk-radar/subscription/tiers
POST /api/risk-radar/subscription/create
GET /api/risk-radar/subscription/:id
POST /api/risk-radar/subscription/:id/analyze
GET /api/risk-radar/subscription/:id/usage
GET /api/risk-radar/subscription/:id/history
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| PORT | Server port (default: 5000) | No |
| NYC_OPEN_DATA_APP_TOKEN | NYC Open Data API token for higher rate limits | Recommended |
| NODE_ENV | Environment (development/production) | No |

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Create `.env` file with configuration
4. Start server: `npm start`
5. Access API documentation: `http://localhost:5000/api`

## Architecture

```
src/
├── config/
│   └── datasets.js        # NYC Open Data dataset configurations
├── services/
│   ├── nycOpenDataService.js   # API client for NYC Open Data
│   ├── riskScoringEngine.js    # Risk calculation algorithms
│   ├── csvExportService.js     # CSV generation
│   ├── portfolioManager.js     # Portfolio operations
│   └── subscriptionService.js  # Subscription management
└── routes/
    └── riskRadar.js       # API route handlers
```

## Data Flow

1. **Input**: User provides list of BBL/BIN identifiers
2. **Fetch**: System queries all three DOB datasets for each property
3. **Aggregate**: Data is consolidated by property
4. **Score**: Risk scoring engine calculates component and overall scores
5. **Output**: Results returned as JSON or exported as CSV

## Rate Limiting

The NYC Open Data API has rate limits. For production use:
- Register for an app token at [NYC Open Data](https://data.cityofnewyork.us/)
- Set `NYC_OPEN_DATA_APP_TOKEN` environment variable
- Built-in retry logic with exponential backoff
- Request throttling (100ms between requests)
