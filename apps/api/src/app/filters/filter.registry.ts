export type { CypherFilter } from '@libs/shared-types';

// ─── Built-in filters ─────────────────────────────────────────────────────────

const publicStart: CypherFilter = {
  startWhere: 'start.publicExposed = true',
};

const sinkEnd: CypherFilter = {
  endWhere: 'end.kind IN ["rds", "sql"]',
};

const hasVulnerability: CypherFilter = {
  pathWhere: 'any(n IN nodes(p) WHERE n.hasVulnerability = true)',
};

// ─── Registry ─────────────────────────────────────────────────────────────────
// To add a new filter: add one entry here. No other changes needed.

export const filterRegistry: Record<string, CypherFilter> = {
  publicStart,
  sinkEnd,
  hasVulnerability,
};

export const AVAILABLE_FILTERS = Object.keys(filterRegistry);
