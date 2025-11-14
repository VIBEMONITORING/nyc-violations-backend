# 🏗️ NYC Violation Compliance System

Enterprise-grade lead generation system for NYC establishment compliance services. Built with autonomous VP role orchestration, real-time data ingestion, and intelligent risk scoring.

## 🎯 System Overview

**Scale Target:** 25,000+ establishments
**Architecture:** Microservices with autonomous orchestration
**Integration:** Full corporate simulation framework

### Key Features

- **Real-time Data Ingestion**: Async pipeline from NYC Open Data APIs
- **Multi-factor Risk Scoring**: 8-component risk assessment algorithm
- **Autonomous VP Orchestration**: Corporate simulation with role-based task generation
- **Lead Generation**: Intelligent prioritization and segmentation
- **Document Automation**: Hearing response and compliance document generation
- **Enterprise Security**: PII encryption, RBAC, audit logging

---

## 📊 Architecture Components

### Data Layer
- **Ingestion Pipeline**: Async/parallel NYC Open Data fetching
- **Quality Validation**: Data cleaning, standardization, enrichment
- **Database**: PostgreSQL 15 with materialized views
- **Cache**: Redis for high-performance caching

### Business Logic
- **Risk Scoring Engine**: 0-1000 point multi-factor risk assessment
- **Lead Generator**: Automated lead qualification and prioritization
- **VP Framework**: 6 autonomous VP roles (Data, CX, Ethics, Engineering, Strategy, Support)

### API Layer
- **FastAPI**: Modern async Python framework
- **REST Endpoints**: Comprehensive API for all operations
- **Real-time Updates**: WebSocket support (optional)

### Frontend (Optional)
- **Analytics Dashboard**: Metabase integration
- **Lead Management**: React-based UI (separate repo)

---

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- NYC Open Data API Token ([Get one here](https://data.cityofnewyork.us/))
- 4GB RAM minimum
- 10GB disk space

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd nyc-violations-backend
```

2. **Create environment file**
```bash
cat > .env << EOF
NYC_OPENDATA_TOKEN=your_token_here
ENCRYPTION_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
DATABASE_URL=postgresql://nyc_user:nyc_password@postgres:5432/nyc_compliance
REDIS_URL=redis://redis:6379/0
LOG_LEVEL=INFO
EOF
```

3. **Start the services**
```bash
docker-compose up -d
```

4. **Verify deployment**
```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00"
}
```

---

## 📖 API Documentation

### Interactive API Docs

Once running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Key Endpoints

#### Data Ingestion
```bash
# Trigger data pipeline
POST /api/v1/ingest/trigger
{
  "datasets": ["inspections", "oath_open"],
  "lookback_days": 30,
  "force_full_refresh": false
}

# Check ingestion status
GET /api/v1/ingest/status
```

#### Lead Management
```bash
# Get leads with filtering
GET /api/v1/leads?status=prospecting&min_priority=7&limit=50

# Get specific lead details
GET /api/v1/leads/{lead_id}

# Generate new leads
POST /api/v1/leads

# Update lead
PUT /api/v1/leads/{lead_id}
```

#### Establishment Data
```bash
# Get establishment profile
GET /api/v1/establishments/{camis}

# Search establishments
GET /api/v1/establishments?query=restaurant&boro=MANHATTAN
```

#### Document Generation
```bash
# Generate hearing response
POST /api/v1/documents/hearing-response?hearing_id=123
```

#### Analytics
```bash
# Dashboard metrics
GET /api/v1/analytics/dashboard

# Trend analysis
GET /api/v1/analytics/trends?metric=conversion_rate&period_days=30
```

#### VP Orchestration
```bash
# Execute autonomous orchestration
POST /api/v1/vp-orchestrator/execute
{
  "objective_name": "Q1 2025 Lead Generation",
  "objective_description": "Generate 500 qualified leads...",
  "deadline": "2025-03-31T23:59:59",
  "priority": "HIGH",
  "automation_enabled": true
}

# Check orchestration status
GET /api/v1/vp-orchestrator/status
```

---

## 🗄️ Database Schema

### Core Tables

- **establishments**: Restaurant/establishment master data
- **inspections**: Health inspection records
- **violation_codes**: Violation reference data
- **hearings**: Administrative hearing records
- **fines**: Outstanding fine records
- **leads**: Sales lead pipeline
- **contact_history**: Lead contact tracking

### Views

- **lead_candidates**: Materialized view for lead generation
- **high_priority_leads**: Filtered view of priority leads
- **compliance_summary**: Establishment compliance overview

### Functions

- `get_establishment_risk_score(camis)`: Calculate risk score
- `refresh_lead_candidates()`: Refresh materialized view

---

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NYC_OPENDATA_TOKEN` | NYC Open Data API token | Yes | - |
| `ENCRYPTION_KEY` | Fernet encryption key | Yes | Generated |
| `DATABASE_URL` | PostgreSQL connection string | Yes | See .env |
| `REDIS_URL` | Redis connection string | Yes | redis://redis:6379/0 |
| `LOG_LEVEL` | Logging level | No | INFO |

### NYC Open Data Datasets

The system ingests from these datasets:

- **43nn-pn8j**: DOHMH Restaurant Inspections
- **jz4z-kudi**: OATH Open Hearings
- **y3hw-z6bm**: OATH Closed Hearings
- **jzhd-m6uv**: DCWP Inspections
- **2xab-argn**: DCWP Payments
- **5fn4-dr26**: DCWP Charges
- **9jgj-bmct**: Environmental Complaints

---

## 🧪 Development

### Local Setup (Without Docker)

1. **Install Python 3.11+**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

2. **Start PostgreSQL and Redis**
```bash
# Using Docker for databases only
docker-compose up -d postgres redis
```

3. **Initialize database**
```bash
psql -U nyc_user -d nyc_compliance -f database/init.sql
```

4. **Run the API**
```bash
export NYC_OPENDATA_TOKEN=your_token
export ENCRYPTION_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
```

### Running Tests

```bash
# Install test dependencies
pip install pytest pytest-asyncio pytest-cov

# Run tests
pytest tests/ -v

# With coverage
pytest tests/ --cov=src --cov-report=html
```

### Code Quality

```bash
# Format code
black src/

# Sort imports
isort src/

# Lint
flake8 src/

# Type checking
mypy src/
```

---

## 📊 Risk Scoring Algorithm

### Components (0-1 scale, weighted)

| Component | Weight | Description |
|-----------|--------|-------------|
| Critical Violations | 150 | Recent critical health violations |
| Repeat Offenses | 100 | Pattern of repeat violations |
| Open Hearings | 80 | Pending administrative actions |
| Outstanding Fines | 60 | Unpaid fines amount |
| Inspection Frequency | 40 | Frequency indicates issues |
| Violation Trend | 70 | Increasing/decreasing pattern |
| Time Since Last | 50 | Recency of violations |
| Complaint Volume | 50 | 311 complaint data |

### Risk Levels

- **CRITICAL** (750+): Immediate action required
- **HIGH** (500-749): High priority engagement
- **MEDIUM** (300-499): Standard follow-up
- **LOW** (100-299): Automated nurture
- **MINIMAL** (0-99): No action needed

### Estimated Value Calculation

```python
Base Value: $500 (consultation)
+ Critical Violations: $250 each
+ Open Hearings: $1,500 each
+ Outstanding Fines: 15% of fine amount
```

---

## 🔐 Security

### Data Protection

- **Encryption at Rest**: Fernet symmetric encryption for PII
- **Encryption in Transit**: HTTPS/TLS required
- **Field-Level Encryption**: Phone, email, legal names
- **Access Control**: Role-based permissions (RBAC)

### Roles & Permissions

| Role | Permissions |
|------|-------------|
| **Admin** | Full access |
| **Sales Manager** | View/edit leads, view PII, export data |
| **Sales Rep** | View/edit leads, view PII |
| **Analyst** | View leads, export data |
| **Viewer** | View leads only |

### Compliance

- **TCPA**: Opt-in verification, DNC list honoring
- **CCPA/GDPR**: Data privacy controls
- **Audit Logging**: All data access tracked

---

## 🎯 VP Orchestration Framework

### Available VP Roles

1. **VP of Data & Analytics**: Pipeline orchestration, data quality
2. **VP of Customer Experience**: Lead engagement, conversion optimization
3. **VP of Ethics & Compliance**: TCPA, privacy, fair practices
4. **VP of Engineering**: System architecture, automation
5. **VP of Strategy**: Market analysis, competitive positioning
6. **VP of Support**: Customer success, retention

### Objective Input Format

```python
{
  "name": "Q1 2025 Campaign",
  "description": "Generate 500 qualified leads, 15% conversion, $1.75M revenue",
  "deadline": "2025-03-31T23:59:59",
  "priority": "HIGH",
  "resource_pool": ["data_analytics", "customer_experience", "engineering"],
  "automation_enabled": true,
  "iteration_loop_enabled": true
}
```

---

## 📈 Monitoring & Analytics

### Metrics Dashboard

Access Metabase at http://localhost:3001

**Default Credentials**:
- Email: admin@example.com
- Password: admin

### Key Metrics

- **Lead Pipeline**: Total leads, conversion rate, pipeline value
- **Data Quality**: Freshness, completeness, validation scores
- **System Performance**: API uptime, response times, error rates
- **Business KPIs**: CAC, LTV, deal size, contact rates

---

## 🐛 Troubleshooting

### Common Issues

**Issue**: API not responding
```bash
# Check container status
docker-compose ps

# Check logs
docker-compose logs api

# Restart services
docker-compose restart api
```

**Issue**: Database connection error
```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Reconnect
docker-compose restart api
```

**Issue**: Data ingestion failing
```bash
# Verify NYC Open Data token
echo $NYC_OPENDATA_TOKEN

# Check ingestion logs
docker-compose logs api | grep ingestion

# Manually trigger with debug
curl -X POST http://localhost:8000/api/v1/ingest/trigger
```

---

## 🚢 Production Deployment

### Recommended Infrastructure

- **Compute**: 2+ vCPUs, 8GB RAM per service
- **Database**: PostgreSQL 15 with 100GB storage
- **Cache**: Redis 7 with 4GB RAM
- **Network**: Load balancer with SSL termination

### Environment Configuration

```bash
# Production environment
export ENVIRONMENT=production
export DEBUG=false
export LOG_LEVEL=WARNING
export DATABASE_POOL_SIZE=20
export REDIS_MAX_CONNECTIONS=50
```

### Scaling

**Horizontal Scaling**:
```bash
# Scale API workers
docker-compose up -d --scale api=3
```

**Database Optimization**:
- Enable connection pooling
- Configure query optimization
- Set up read replicas for analytics

---

## 📝 License

[Specify License]

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📞 Support

For issues and questions:
- **GitHub Issues**: [Link to issues]
- **Documentation**: [Link to docs]
- **Email**: support@example.com

---

## 🙏 Acknowledgments

- NYC Open Data platform for comprehensive datasets
- FastAPI framework for modern Python APIs
- PostgreSQL for robust data storage

---

**Built with ❤️ for NYC compliance professionals**
