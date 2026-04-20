# E2E Test Plan — Graph API

## Coverage Gaps (vs existing `api.spec.ts`)

| Area | Existing | Missing |
|------|----------|---------|
| `GET /api/health` | ✗ | All |
| Graph edge referential integrity | ✗ | All |
| `publicStart` semantic correctness | Partial | Public nodes are SOURCES |
| `sinkEnd` semantic correctness | Partial | rds/sql nodes are SINKS |
| Vulnerability object shape | ✗ | file/severity/message fields |
| Multiple unknown filters in error | ✗ | All |
| Whitespace trimming in filters param | ✗ | All |
| Combined filter semantic correctness | Partial | Both constraints met simultaneously |

---

## Suite 1 — `GET /api/health`

| # | Test | Expected |
|---|------|----------|
| 1.1 | Returns 200 when both services up | `status === 200` |
| 1.2 | Response shape: `{ status, details: { neo4j, redis } }` | All keys present |
| 1.3 | `status` field is `'ok'` | `res.data.status === 'ok'` |
| 1.4 | `details.neo4j.status` is `'up'` | `=== 'up'` |
| 1.5 | `details.redis.status` is `'up'` | `=== 'up'` |
| 1.6 | No `error` field when services healthy | `neo4j.error` and `redis.error` undefined |

---

## Suite 2 — `GET /api/graph` Structural Integrity

| # | Test | Expected |
|---|------|----------|
| 2.1 | All edge `from` values reference a node name in `nodes` | Every `edge.from` in `nodeNames` set |
| 2.2 | All edge `to` values reference a node name in `nodes` | Every `edge.to` in `nodeNames` set |

---

## Suite 3 — `GET /api/graph/routes` Filter Semantic Correctness

### 3a — `publicStart`

| # | Test | Expected |
|---|------|----------|
| 3a.1 | Every SOURCE node (no incoming edges) has `publicExposed === true` | All source nodes public |
| 3a.2 | All edge `from`/`to` reference nodes in the result | Referential integrity |

### 3b — `sinkEnd`

| # | Test | Expected |
|---|------|----------|
| 3b.1 | At least one SINK node (no outgoing edges) has `kind` `rds` or `sql` | Sink is rds/sql |
| 3b.2 | All edge `from`/`to` reference nodes in the result | Referential integrity |

### 3c — `hasVulnerability`

| # | Test | Expected |
|---|------|----------|
| 3c.1 | Vulnerability objects have `file` (string) field | `typeof vuln.file === 'string'` |
| 3c.2 | Vulnerability objects have `severity` field (`low`/`medium`/`high`/`critical`) | Valid enum value |
| 3c.3 | Vulnerability objects have `message` (string) field | `typeof vuln.message === 'string'` |
| 3c.4 | All edge `from`/`to` reference nodes in the result | Referential integrity |

---

## Suite 4 — `GET /api/graph/routes` Error Edge Cases (Extended)

| # | Test | Expected |
|---|------|----------|
| 4.1 | Multiple unknown filters → all listed in error message | `message` contains `bogus1` AND `bogus2` |
| 4.2 | Whitespace around filter names trimmed (`filters=publicStart, sinkEnd`) | `200` valid graph |
| 4.3 | Mixed valid + invalid filter → 400 listing the invalid one | `400` with invalid name in message |

---

## Suite 5 — `GET /api/graph/routes` Combined Filters Semantic Correctness

| # | Test | Expected |
|---|------|----------|
| 5.1 | `publicStart + sinkEnd`: result has at least one public source node | `publicExposed === true` source exists |
| 5.2 | `publicStart + sinkEnd`: result has at least one rds/sql sink node | `kind rds/sql` sink exists |
| 5.3 | `publicStart + hasVulnerability`: result has public source AND vulnerable node | Both constraints met |
| 5.4 | `sinkEnd + hasVulnerability`: result has rds/sql sink AND vulnerable node | Both constraints met |
| 5.5 | All 3 filters: result satisfies all 3 constraints simultaneously | All constraints met |
| 5.6 | All 3 filters: edges reference only nodes in the result | Referential integrity |

---

## Implementation Files

- **Target:** `apps/api-e2e/src/api/api.spec.ts` (append new describe blocks)
- **Style:** Match existing — `axios`, `beforeAll`, `AnyRecord` helpers
- **No new files** unless structure demands it
