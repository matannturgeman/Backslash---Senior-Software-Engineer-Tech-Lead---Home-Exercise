# Infrastructure & Deployment

## Services Overview

```
┌──────────────────────────────────────────────┐
│  docker-compose.yml                          │
│                                              │
│  ┌─────────────┐    ┌──────────────────┐    │
│  │  neo4j:5    │    │  redis:7-alpine  │    │
│  │             │    │                  │    │
│  │ bolt: 7687  │    │  port: 6379      │    │
│  │ http: 7474  │    │                  │    │
│  └─────────────┘    └──────────────────┘    │
│                                              │
│  (API runs outside compose — npm run dev)    │
└──────────────────────────────────────────────┘
```

---

## Environment Variables

All variables are optional; defaults apply when not set.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | API listen port |
| `HOST` | `localhost` | API listen host |
| `API_PREFIX` | `api` | URL prefix for all routes |
| `NEO4J_URI` | `bolt://localhost:7687` | Neo4j connection URI |
| `NEO4J_USER` | `neo4j` | Neo4j username |
| `NEO4J_PASS` | `password` | Neo4j password |
| `REDIS_HOST` | `localhost` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `CACHE_TTL` | `300` | Cache entry lifetime in seconds |
| `MAX_PATH_DEPTH` | `20` | Max relationship hops in Cypher path query |
| `MAX_RESULT_PATHS` | `10000` | Cypher `LIMIT` — max paths returned from Neo4j |
| `MAX_RESPONSE_NODES` | `5000` | Max deduplicated nodes in a response (400 if exceeded) |

Copy `.env.example` to `.env` and adjust as needed.

---

## Running Locally

### 1. Start dependencies
```bash
docker compose up -d
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start the API in watch mode
```bash
npm run dev:api
# or
npx nx serve api
```

API: `http://localhost:3000/api`
Swagger: `http://localhost:3000/docs`
Neo4j Browser: `http://localhost:7474`

---

## Building for Production

```bash
npx nx build api
# Output: dist/api/main.js (webpack bundle with bundled deps)
# Assets: dist/api/assets/train-ticket.json (auto-copied)
```

Run the build:
```bash
node dist/api/main.js
```

---

## Docker Build

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install -g pnpm
RUN pnpm install
RUN pnpm nx build api
CMD ["node", "dist/apps/api/main.js"]
```

Build and run:
```bash
docker build -t backslash-api .
docker run -p 3000:3000 \
  -e NEO4J_URI=bolt://neo4j:7687 \
  -e REDIS_HOST=redis \
  backslash-api
```

---

## Running Tests

### Unit tests
```bash
npx nx test api
```

### E2E tests (requires Docker — spins up real Neo4j + Redis via Testcontainers)
```bash
npx nx e2e api-e2e
```

E2E setup (`global-setup.ts`):
1. Start Neo4j container (Testcontainers)
2. Start Redis container (Testcontainers)
3. Set env vars pointing to container ports
4. Build and start the API server process
5. Wait for health check to pass

---

## Neo4j Schema

```cypher
-- Constraint (ensures uniqueness, prevents duplicates)
CREATE CONSTRAINT ON (n:Node) ASSERT n.name IS UNIQUE;

-- Node properties stored in Neo4j
(:Node {
  name: string,            -- unique
  kind: string,            -- "service" | "rds" | "sqs" | "sql"
  publicExposed: boolean,
  hasVulnerability: boolean,
  language: string,
  path: string,
  metadata: string         -- JSON-serialized object
})

-- Edge
(:Node)-[:CALLS]->(:Node)

-- Seed optimization
(:GraphMeta { hash: string })  -- SHA-256 of train-ticket.json
```

---

## NX Monorepo Commands

| Command | Description |
|---|---|
| `npx nx serve api` | Start API in dev/watch mode |
| `npx nx build api` | Production webpack build |
| `npx nx test api` | Run unit tests |
| `npx nx e2e api-e2e` | Run E2E tests |
| `npx nx graph` | Visualize project dependency graph |
| `npx nx affected:test` | Run tests only for changed projects |
