# NYC Violations Backend

A Rails API backend for tracking NYC business violations. Built following [Evil Martians Rails conventions](https://evilmartians.com/).

## Technology Stack

- **Ruby** 3.3.0
- **Rails** 7.1 (API mode)
- **PostgreSQL** for database
- **RSpec** for testing
- **anyway_config** for configuration

## Quick Start

```bash
# Install dependencies
bundle install

# Setup database
bin/rails db:create db:migrate db:seed

# Run the server
bin/rails server
```

## API Endpoints

### Health Check

```
GET /health
```

Returns API status and timestamp.

### Violations

```
GET /api/v1/violations
GET /api/v1/violations/:id
```

Query parameters for filtering:
- `state` - Filter by violation state (reported, pending, under_review, resolved, dismissed)
- `severity` - Filter by severity level (low, medium, high, critical)
- `agency_code` - Filter by agency code (e.g., DOH, DCWP)
- `borough` - Filter by NYC borough
- `issued_after` - Filter violations issued after date
- `issued_before` - Filter violations issued before date

### Businesses

```
GET /api/v1/businesses
GET /api/v1/businesses/:id
GET /api/v1/businesses/:id/violations
```

Query parameters:
- `borough` - Filter by NYC borough
- `has_violations` - Filter to businesses with active violations

## Project Structure

```
app/
├── models/
│   ├── agency.rb
│   ├── business.rb
│   ├── violation.rb
│   └── violation/
│       ├── active_query.rb
│       └── search_query.rb
├── controllers/
│   ├── health_controller.rb
│   └── api/v1/
│       ├── violations_controller.rb
│       ├── businesses_controller.rb
│       └── business_violations_controller.rb
config/
└── configs/
    ├── application_config.rb
    ├── app_config.rb
    └── database_config.rb
spec/
├── models/
├── requests/
└── factories/
```

## Configuration

Configuration is managed via `anyway_config`. Set environment variables:

```bash
APP_HOST=localhost
APP_PORT=5000
```

## Testing

```bash
# Run all tests
bundle exec rspec

# Run specific test file
bundle exec rspec spec/models/violation_spec.rb

# Run with verbose output
bundle exec rspec -f d
```

## Code Style

This project uses Standard Ruby for linting:

```bash
bundle exec standardrb
bundle exec standardrb --fix
```

## License

MIT
