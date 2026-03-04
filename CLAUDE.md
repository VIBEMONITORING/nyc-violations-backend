# CLAUDE.md - NYC Violations Backend

This file provides guidance for AI assistants working in this repository.

## Project Overview

A Node.js/Express REST API backend for querying NYC business violations data. The `pg` dependency is included but the database connection is not yet implemented — current endpoints return hardcoded placeholder data.

## Repository Structure

```
nyc-violations-backend/
├── server.js        # Main application entry point (Express server, routes)
├── package.json     # Dependencies and npm scripts
├── .gitignore       # Standard Node.js gitignore
└── README.md        # Minimal project title only
```

## Tech Stack

| Layer      | Technology            | Version  |
|------------|-----------------------|----------|
| Runtime    | Node.js               | 18.x     |
| Framework  | Express               | ^4.18.2  |
| Database   | PostgreSQL (pg driver)| ^8.11.3  |
| Middleware | cors                  | ^2.8.5   |
| Config     | dotenv                | ^16.3.1  |

## Development Setup

```bash
# Install dependencies
npm install

# Start the server (runs on port 5000 by default)
npm start
```

Environment variables are loaded from a `.env` file via dotenv. No `.env.example` exists yet — the only variable currently used is:

```
PORT=5000   # optional, defaults to 5000
```

A `DATABASE_URL` or equivalent PostgreSQL connection variable will be needed once DB integration is implemented.

## API Endpoints

| Method | Path              | Description                        | Status        |
|--------|-------------------|------------------------------------|---------------|
| GET    | `/health`         | Liveness check                     | Implemented   |
| GET    | `/api/violations` | List violations (hardcoded data)   | Placeholder   |

**GET /health** response:
```json
{ "status": "healthy", "timestamp": "<ISO date>", "message": "NYC Violations API is running!" }
```

**GET /api/violations** response (hardcoded test data):
```json
{
  "message": "Violations endpoint",
  "data": [
    { "id": 1, "business": "Test Restaurant", "agency": "DOH", "severity": 8 },
    { "id": 2, "business": "Test Cafe", "agency": "DCWP", "severity": 6 }
  ]
}
```

## Code Conventions

- CommonJS modules (`require`/`module.exports`) — no ESM
- No TypeScript; plain JavaScript
- Express route handlers defined directly in `server.js` (no router separation yet)
- Environment config loaded at startup via `require('dotenv').config()`
- Port defaults to `5000`

## What Is Not Yet Implemented

- Database connection (the `pg` package is installed but unused)
- Real violations data queries
- Error handling middleware
- Input validation
- Request logging
- Tests (no test framework configured)
- CI/CD pipeline
- Docker / deployment configuration
- `.env.example` template

## Adding New Endpoints

New routes should be added in `server.js` following the existing pattern:

```js
app.get('/api/<resource>', (req, res) => {
  // handler
});
```

Once the project grows, routes should be split into `routes/` and database logic into `db/` or `models/` directories.

## Running / Testing Manually

```bash
# Health check
curl http://localhost:5000/health

# Violations list
curl http://localhost:5000/api/violations
```

No automated test suite exists. When adding one, prefer **Jest** (standard for Node.js/Express projects).

## Git Workflow

- The working branch for AI-assisted changes is `claude/add-claude-documentation-VdoU6`
- Commit messages should be concise and descriptive (imperative mood)
- Push with: `git push -u origin <branch-name>`
