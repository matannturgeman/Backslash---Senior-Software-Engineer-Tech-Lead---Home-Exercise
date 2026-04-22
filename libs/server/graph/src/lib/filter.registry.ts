export type { CypherFilter } from '@libs/shared-types';

// ─── Built-in filters ─────────────────────────────────────────────────────────

const publicStart: import('@libs/shared-types').CypherFilter = {
  startWhere: 'start.publicExposed = true',
};

const sinkEnd: import('@libs/shared-types').CypherFilter = {
  endWhere: 'end.kind IN ["rds", "sql"]',
};

const hasVulnerability: import('@libs/shared-types').CypherFilter = {
  pathWhere: 'any(n IN nodes(p) WHERE n.hasVulnerability = true)',
};

// ─── Registry ─────────────────────────────────────────────────────────────────
// To add a new filter: add one entry here. No other changes needed.

export const filterRegistry: Record<string, import('@libs/shared-types').CypherFilter> = {
  publicStart,
  sinkEnd,
  hasVulnerability,
};

export const AVAILABLE_FILTERS = Object.keys(filterRegistry);
