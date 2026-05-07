# API Gateway + Rate Limiting Platform

A developer platform for API key management, usage quotas, rate limiting, analytics, logs, and developer docs.

## Features

- API key generation and management
- Usage quotas and request rate limiting
- Request analytics and developer dashboards
- JWT validation and request inspection
- Developer console with docs and charts

## Tech stack

- Node.js backend
- Redis for rate limiting and caching
- PostgreSQL for persistent data
- React / Vite frontend

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the backend and frontend together:
   ```bash
   npm run dev
   ```

3. Or use Docker:
   ```bash
   npm run docker:up
   ```

## Project structure

- `backend/` - API server, authentication, rate limiting, analytics
- `frontend/` - developer console, usage charts, docs
- `docker-compose.yml` - local Redis/PostgreSQL environment
