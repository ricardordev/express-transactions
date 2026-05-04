# Transactions API — Express.js

A REST API built with **Express.js**, **TypeScript**, and **Prisma** supporting PostgreSQL, MySQL, and MariaDB. Features JWT authentication, refresh token rotation, soft-delete transactions, rate limiting, and a DDD (Domain-Driven Design) architecture.

> [!IMPORTANT]
> **Disclaimer:** This is example code. For production use, set `NODE_ENV=production` and configure a strong `JWT_SECRET`. Adjust `prisma/schema.prisma` models, routes, controllers, services, validators, types, and middlewares as needed.

---

## Features

| Category | Details |
|----------|---------|
| **Architecture** | DDD — feature-based modules (`auth/`, `transactions/`), shared `infrastructure/` and `middleware/` |
| **Auth** | JWT access tokens (configurable expiry), refresh token rotation with family-based reuse detection, dual delivery (body + httpOnly cookie) |
| **Security** | Helmet (CSP, HSTS, X-Frame-Options), CORS (ALLOWED_ORIGINS), JWT authentication |
| **Validation** | Zod schemas for request body, query params, and route params |
| **Rate Limiting** | Configurable via `RATE_LIMIT_REQUESTS` and `RATE_LIMIT_SECONDS` |
| **Logging** | Morgan HTTP request logger |
| **Documentation** | Swagger UI at `/docs` with auto-generated OpenAPI 3.0 schema |
| **Graceful Shutdown** | SIGTERM/SIGINT handling with Prisma disconnect |
| **Health Check** | `GET /health` with uptime and timestamp |
| **Soft Delete** | Transactions are soft-deleted (`deleted_at`), only by the owner |
| **Testing** | Vitest — unit, integration, and E2E tests with coverage thresholds |

---

## Environment Variables

Create a `.env` file (copy from `.env.example`) and configure:

```env
# Database (mysql, postgresql, or mariadb)
DATABASE_TYPE="mysql"
DATABASE_HOST="localhost"
DATABASE_PORT="3306"
DATABASE_USER="user"
DATABASE_PASSWORD="pass"
DATABASE_NAME="transactions"
DATABASE_URL="mysql://user:pass@localhost:3306/transactions"

# PostgreSQL alternative:
# DATABASE_TYPE="postgresql"
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/transactions?schema=public"

# Server
PORT=3000
ALLOWED_ORIGINS=http://localhost:5173

# JWT
JWT_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
JWT_REFRESH_SECRET=

# Rate Limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_SECONDS=60
```

> [!NOTE]
> `NODE_ENV=production` changes behavior:
> - Authentication is **enforced** (JWT_SECRET required)
> - Refresh token cookies use `secure: true`
> - Error messages are **sanitized** (no internal details leaked)

---

## Getting Started

```bash
# Install dependencies
npm install

# Configure your .env file
cp .env.example .env

# Push the schema to the database (fresh install, no migrations)
npx prisma db push

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
```

```
API running on http://localhost:3000
Docs: http://localhost:3000/docs
Health: http://localhost:3000/health
```

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | ❌ | Health check with uptime |
| `POST` | `/auth/login` | ❌ | Login — returns access + refresh token pair |
| `POST` | `/auth/refresh` | ❌ | Rotate refresh token — returns new pair |
| `POST` | `/auth/logout` | ✅ | Revoke session and clear cookie |
| `GET` | `/auth/me` | ✅ | Get authenticated user profile |
| `GET` | `/transactions` | ✅ | List transactions (paginated, excludes soft-deleted) |
| `GET` | `/transactions/:hash` | ✅ | Get a transaction by hash |
| `POST` | `/transactions` | ✅ | Create a new transaction |
| `PUT` | `/transactions/:hash` | ✅ | Update a transaction |
| `DELETE` | `/transactions/:hash` | ✅ | Soft-delete (owner only) |
| `GET` | `/docs` | ❌ | Swagger UI documentation |

**Query Parameters for `GET /transactions`:**
- `page` (default: `1`) — Page number
- `limit` (default: `10`) — Items per page

---

## Authentication

> [!WARNING]
> Authentication is **bypassed** in development when `JWT_SECRET` is empty. In production (`NODE_ENV=production`), a missing `JWT_SECRET` returns `500`.

### 1. Create a User

Insert a user record into the database. You can use the mock user below for testing:

```sql
-- login: test
-- password: 12345678
INSERT INTO users (login, password, name, email) VALUES ('test', '$2a$10$p1dKqW/HF617f2NEJd.ZDO7gHXmmD4uVSV43I5hM5Oe9.UF8JFqcq', 'User Test', 'test@test.com');
```

### 2. Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-type: application/json' \
  -d '{"login":"john_doe","password":"your_password"}'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "type": "Bearer",
  "expires_in": "15m",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "lookup_key": "550e8400-e29b-41d4-a716-446655440000"
}
```
A `refresh_token` httpOnly cookie is also set automatically for browser clients.

### 3. Get Current User

```bash
curl -X GET http://localhost:3000/auth/me \
  -H 'Authorization: Bearer {token}'
```

**Response:**
```json
{
  "id": 1,
  "login": "john_doe",
  "name": "John Doe",
  "email": "john@example.com",
  "created_at": "2026-07-12T00:00:00.000Z"
}
```

### 4. Refresh Token

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H 'Content-type: application/json' \
  -d '{"refresh_token":"eyJhbGciOi...","lookup_key":"550e8400-..."}'
```

Browser clients can omit `refresh_token` from the body — it's read from the httpOnly cookie automatically.

---

## Testing

The project uses **Vitest** with three test layers:

| Layer | Command | Files | Needs DB |
|-------|---------|-------|----------|
| Unit | `npm run test` | `src/**/__tests__/*.test.ts` (103 tests) | ❌ |
| Unit + Integration | `npm run test:cov` | Unit + `test/integration/` (120 tests) | ✅ |
| E2E | `npm run test:e2e` | `test/e2e/` (26 tests) | ✅ |

### Running Tests

```bash
# Unit tests only (fast, no database required)
npm run test

# Unit + Integration with coverage report
npm run test:cov

# E2E tests (requires running test database)
npm run test:e2e
```

### Test Database Setup

Integration and E2E tests require a separate test database. Create a `.env.test` file pointing to it:

```env
DATABASE_URL="mysql://user:pass@localhost:3306/transactions_test"
```

The `pretest` script runs `prisma migrate deploy` automatically. Make sure your test database schema is up to date before running integration or E2E tests.

### Coverage

Coverage uses `@vitest/coverage-v8` with an **80% threshold** for lines and branches. Reports are generated in `text`, `html`, and `lcov` (SonarQube-compatible) formats.

```bash
npm run test:cov
# Output: coverage/index.html, coverage/lcov.info
```

> **Non-testable files** (type definitions, route glue, infrastructure bootstraps) are excluded from coverage to keep thresholds meaningful — only business logic is measured.

---

## Usage Examples

### Create Transaction
```bash
curl -X POST http://localhost:3000/transactions \
  -H 'Content-type: application/json' \
  -H 'Authorization: Bearer {token}' \
  -d '{"name":"Invoice 1","amount":250.00,"created_at":"2026-05-04T17:54:45"}'
```

### List Transactions (Paginated)
```bash
curl -X GET 'http://localhost:3000/transactions?page=1&limit=10' \
  -H 'Authorization: Bearer {token}'
```

### Get Transaction by Hash
```bash
curl -X GET http://localhost:3000/transactions/{hash} \
  -H 'Authorization: Bearer {token}'
```

### Update Transaction
```bash
curl -X PUT http://localhost:3000/transactions/{hash} \
  -H 'Content-type: application/json' \
  -H 'Authorization: Bearer {token}' \
  -d '{"name":"Invoice 1 Updated","amount":300.00}'
```

### Delete Transaction (Soft Delete)
```bash
curl -X DELETE http://localhost:3000/transactions/{hash} \
  -H 'Authorization: Bearer {token}'
```
> Response: `204 No Content`. Only the owner (`created_by`) can delete. `deleted_at` and `deleted_by` are set on the row — the record is not physically removed.

---

## Project Structure

```
src/
├── server.ts                       # Bootstrap, middleware stack, graceful shutdown
├── config/
│   ├── env.ts                      # Typed environment variable reader
│   └── cors.ts                     # CORS configuration (ALLOWED_ORIGINS)
├── infrastructure/
│   ├── prisma.ts                   # Prisma client singleton (MySQL/PostgreSQL adapter)
│   ├── error-handler.ts            # Global Express error handler (Zod, Prisma, generic)
│   └── swagger.ts                  # OpenAPI documentation + Zod extension
├── middleware/
│   ├── authenticate.ts             # JWT Bearer authentication middleware
│   └── validate.ts                 # Zod request validation middleware
├── types/
│   ├── index.ts                    # PaginatedResponse, Transaction types
│   └── express.d.ts                # Express Request type augmentation (req.user)
├── auth/
│   ├── auth.routes.ts              # POST /auth, POST /auth/refresh, GET /auth/me
│   ├── auth.controller.ts          # HTTP handlers
│   ├── auth.service.ts             # Login, refresh with rotation, getUserProfile
│   └── auth.schema.ts              # Zod schemas: loginSchema, refreshSchema
├── transactions/
│   ├── transactions.routes.ts      # GET/POST /transactions, /:hash
│   ├── transactions.controller.ts  # HTTP handlers
│   ├── transactions.service.ts     # List, find, create, update, softDelete
│   ├── transactions.schema.ts      # Zod schemas
│   └── __tests__/                  # Unit tests (service, controller, schemas)
├── generated/
│   └── prisma/                     # Generated Prisma client
├── test/
│   ├── integration/                # Integration tests (DB required)
│   │   ├── auth.test.ts
│   │   ├── transactions.test.ts
│   │   └── refresh-rotation.test.ts
│   └── e2e/                        # E2E tests (HTTP via supertest)
│       ├── auth-e2e.test.ts
│       └── transactions-e2e.test.ts
```

---

## Graceful Shutdown

The server handles `SIGTERM` and `SIGINT` signals for clean shutdown:

1. Stops accepting new connections
2. Disconnects from the database (`prisma.$disconnect()`)
3. Force exits after 10 seconds if shutdown hangs

---

## Deployment

```bash
# Build TypeScript
npm run build

# Start production server
NODE_ENV=production npm start
```

For production, ensure:
- `NODE_ENV=production` is set
- `JWT_SECRET` is a strong, unique secret (and `JWT_REFRESH_SECRET` for cryptographic isolation)
- `ALLOWED_ORIGINS` lists only trusted domains
- The database is properly firewalled and connection is TLS-encrypted

---

ricardo albrecht - ricardoalbrecht1@gmail.com