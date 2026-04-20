# Filters

Filters are the core extensibility mechanism of the query engine. Each filter is a pure function that takes a route (array of nodes) and returns `true` if the route matches.

---

## Built-in Filters

### `publicStart`

**Description:** Keeps routes whose first node is publicly exposed (internet-facing).

**Logic:** `path[0].publicExposed === true`

**Use case:** Find all attack surfaces reachable from the internet.

---

### `sinkEnd`

**Description:** Keeps routes whose last node is a data sink (RDS or SQL database).

**Logic:** `["rds", "sql"].includes(path.at(-1)?.kind)`

**Use case:** Find all paths that reach a database — useful for data exfiltration risk analysis.

---

### `hasVulnerability`

**Description:** Keeps routes that pass through at least one node with a known vulnerability.

**Logic:** `path.some(node => node.vulnerabilities?.length > 0)`

**Use case:** Find all routes that touch vulnerable services.

---

## Combining Filters

Filters are specified as a comma-separated list in the `filters` query param.
All specified filters are applied with **AND logic** — a route must satisfy every filter to be included.

**Example — routes from internet to database through a vulnerability:**
```
GET /api/graph/routes?filters=publicStart,sinkEnd,hasVulnerability
```

---

## Adding a New Filter

1. Create `apps/api/src/app/filters/my-filter.filter.ts`:

```ts
import { FilterFn } from './filter.interface';

export const myFilter: FilterFn = (path) => {
  // your logic here
  return path.length > 3;
};
```

2. Register it in `filter.registry.ts`:

```ts
import { myFilter } from './my-filter.filter';

export const filterRegistry: Record<string, FilterFn> = {
  publicStart,
  sinkEnd,
  hasVulnerability,
  longRoute: myFilter,   // ← add this line
};
```

3. It's now available via `?filters=longRoute`. No other changes needed.
