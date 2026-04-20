import axios from 'axios';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type AnyRecord = Record<string, unknown>;

const isValidNode = (n: unknown) => {
  const node = n as AnyRecord;
  return typeof node['name'] === 'string' && typeof node['kind'] === 'string';
};

const isValidEdge = (e: unknown) => {
  const edge = e as AnyRecord;
  return typeof edge['from'] === 'string' && typeof edge['to'] === 'string';
};

const isValidGraph = (data: unknown) => {
  const g = data as AnyRecord;
  return (
    Array.isArray(g['nodes']) &&
    Array.isArray(g['edges']) &&
    (g['nodes'] as unknown[]).every(isValidNode) &&
    (g['edges'] as unknown[]).every(isValidEdge)
  );
};

// ─── GET /api/graph ───────────────────────────────────────────────────────────

describe('GET /api/graph', () => {
  it('returns 200 with a valid graph shape', async () => {
    const res = await axios.get('/api/graph');
    expect(res.status).toBe(200);
    expect(isValidGraph(res.data)).toBe(true);
  });

  it('returns all 46 nodes from train-ticket.json', async () => {
    const res = await axios.get('/api/graph');
    expect(res.data.nodes.length).toBe(46);
  });

  it('returns all 98 edges from train-ticket.json', async () => {
    const res = await axios.get('/api/graph');
    expect(res.data.edges.length).toBe(98);
  });

  it('each node has name and kind fields', async () => {
    const res = await axios.get('/api/graph');
    for (const node of res.data.nodes) {
      expect(typeof node.name).toBe('string');
      expect(typeof node.kind).toBe('string');
    }
  });
});

// ─── GET /api/graph/filters ───────────────────────────────────────────────────

describe('GET /api/graph/filters', () => {
  it('returns 200 with a filters array', async () => {
    const res = await axios.get('/api/graph/filters');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.filters)).toBe(true);
  });

  it('includes all 3 built-in filters', async () => {
    const res = await axios.get('/api/graph/filters');
    expect(res.data.filters).toContain('publicStart');
    expect(res.data.filters).toContain('sinkEnd');
    expect(res.data.filters).toContain('hasVulnerability');
  });
});

// ─── GET /api/graph/routes — error cases ─────────────────────────────────────

describe('GET /api/graph/routes — error cases', () => {
  it('returns 400 when filters param is missing', async () => {
    const res = await axios.get('/api/graph/routes', { validateStatus: () => true });
    expect(res.status).toBe(400);
  });

  it('returns 400 when filters param is empty string', async () => {
    const res = await axios.get('/api/graph/routes?filters=', { validateStatus: () => true });
    expect(res.status).toBe(400);
  });

  it('returns 400 for unknown filter name', async () => {
    const res = await axios.get('/api/graph/routes?filters=bogus', { validateStatus: () => true });
    expect(res.status).toBe(400);
    expect(res.data.message).toMatch(/bogus/);
    expect(res.data.message).toMatch(/Available/);
  });

  it('400 error message lists all valid filter names', async () => {
    const res = await axios.get('/api/graph/routes?filters=bogus', { validateStatus: () => true });
    expect(res.data.message).toContain('publicStart');
    expect(res.data.message).toContain('sinkEnd');
    expect(res.data.message).toContain('hasVulnerability');
  });
});

// ─── GET /api/graph/routes?filters=publicStart ────────────────────────────────

describe('GET /api/graph/routes?filters=publicStart', () => {
  let data: { nodes: AnyRecord[]; edges: AnyRecord[] };

  beforeAll(async () => {
    data = (await axios.get('/api/graph/routes?filters=publicStart')).data;
  });

  it('returns 200 with valid graph shape', () => {
    expect(isValidGraph(data)).toBe(true);
  });

  it('result nodes are a subset of the full graph', async () => {
    const fullNames = new Set(
      (await axios.get('/api/graph')).data.nodes.map((n: AnyRecord) => n['name']),
    );
    for (const node of data.nodes) {
      expect(fullNames.has(node['name'])).toBe(true);
    }
  });

  it('contains at least one publicly exposed node', () => {
    expect(data.nodes.some((n) => n['publicExposed'] === true)).toBe(true);
  });
});

// ─── GET /api/graph/routes?filters=sinkEnd ───────────────────────────────────

describe('GET /api/graph/routes?filters=sinkEnd', () => {
  let data: { nodes: AnyRecord[]; edges: AnyRecord[] };

  beforeAll(async () => {
    data = (await axios.get('/api/graph/routes?filters=sinkEnd')).data;
  });

  it('returns 200 with valid graph shape', () => {
    expect(isValidGraph(data)).toBe(true);
  });

  it('contains at least one rds or sql node', () => {
    expect(
      data.nodes.some((n) => n['kind'] === 'rds' || n['kind'] === 'sql'),
    ).toBe(true);
  });
});

// ─── GET /api/graph/routes?filters=hasVulnerability ──────────────────────────

describe('GET /api/graph/routes?filters=hasVulnerability', () => {
  let data: { nodes: AnyRecord[]; edges: AnyRecord[] };

  beforeAll(async () => {
    data = (await axios.get('/api/graph/routes?filters=hasVulnerability')).data;
  });

  it('returns 200 with valid graph shape', () => {
    expect(isValidGraph(data)).toBe(true);
  });

  it('contains at least one node with vulnerabilities', () => {
    expect(
      data.nodes.some(
        (n) =>
          Array.isArray(n['vulnerabilities']) &&
          (n['vulnerabilities'] as unknown[]).length > 0,
      ),
    ).toBe(true);
  });
});

// ─── GET /api/graph — structural integrity ────────────────────────────────────

describe('GET /api/graph — structural integrity', () => {
  let nodes: AnyRecord[];
  let edges: AnyRecord[];

  beforeAll(async () => {
    const res = await axios.get('/api/graph');
    nodes = res.data.nodes as AnyRecord[];
    edges = res.data.edges as AnyRecord[];
  });

  it('all edge "from" values reference a node that exists in the graph', () => {
    const nodeNames = new Set(nodes.map((n) => n['name']));
    for (const edge of edges) {
      expect(nodeNames.has(edge['from'])).toBe(true);
    }
  });

  it('all edge "to" values reference a node that exists in the graph', () => {
    const nodeNames = new Set(nodes.map((n) => n['name']));
    for (const edge of edges) {
      expect(nodeNames.has(edge['to'])).toBe(true);
    }
  });
});

// ─── GET /api/graph/routes — combined filters ─────────────────────────────────

describe('GET /api/graph/routes — combined filters', () => {
  it('publicStart + sinkEnd returns valid graph shape', async () => {
    const res = await axios.get('/api/graph/routes?filters=publicStart,sinkEnd');
    expect(res.status).toBe(200);
    expect(isValidGraph(res.data)).toBe(true);
  });

  it('all 3 filters combined returns valid graph shape', async () => {
    const res = await axios.get(
      '/api/graph/routes?filters=publicStart,sinkEnd,hasVulnerability',
    );
    expect(res.status).toBe(200);
    expect(isValidGraph(res.data)).toBe(true);
  });

  it('response nodes contain no duplicates', async () => {
    const res = await axios.get('/api/graph/routes?filters=sinkEnd');
    const names = res.data.nodes.map((n: AnyRecord) => n['name']);
    expect(new Set(names).size).toBe(names.length);
  });

  it('response edges contain no duplicates', async () => {
    const res = await axios.get('/api/graph/routes?filters=sinkEnd');
    const keys = res.data.edges.map(
      (e: AnyRecord) => `${e['from']}→${e['to']}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ─── GET /api/health ──────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  let data: AnyRecord;
  let status: number;

  beforeAll(async () => {
    const res = await axios.get('/api/health', { validateStatus: () => true });
    status = res.status;
    data = res.data as AnyRecord;
  });

  it('returns 200 when both services are up', () => {
    expect(status).toBe(200);
  });

  it('response has expected shape { status, details: { neo4j, redis } }', () => {
    expect(typeof data['status']).toBe('string');
    expect(typeof data['details']).toBe('object');
    const details = data['details'] as AnyRecord;
    expect(typeof details['neo4j']).toBe('object');
    expect(typeof details['redis']).toBe('object');
  });

  it('top-level status is "ok"', () => {
    expect(data['status']).toBe('ok');
  });

  it('neo4j status is "up"', () => {
    const details = data['details'] as AnyRecord;
    const neo4j = details['neo4j'] as AnyRecord;
    expect(neo4j['status']).toBe('up');
  });

  it('redis status is "up"', () => {
    const details = data['details'] as AnyRecord;
    const redis = details['redis'] as AnyRecord;
    expect(redis['status']).toBe('up');
  });

  it('no error field present when services are healthy', () => {
    const details = data['details'] as AnyRecord;
    const neo4j = details['neo4j'] as AnyRecord;
    const redis = details['redis'] as AnyRecord;
    expect(neo4j['error']).toBeUndefined();
    expect(redis['error']).toBeUndefined();
  });
});

// ─── GET /api/graph/routes — error edge cases (extended) ──────────────────────

describe('GET /api/graph/routes — error edge cases (extended)', () => {
  it('multiple unknown filters are all listed in the error message', async () => {
    const res = await axios.get('/api/graph/routes?filters=bogus1,bogus2', {
      validateStatus: () => true,
    });
    expect(res.status).toBe(400);
    expect(res.data.message).toMatch(/bogus1/);
    expect(res.data.message).toMatch(/bogus2/);
  });

  it('whitespace around filter names is trimmed (filters=publicStart, sinkEnd)', async () => {
    const res = await axios.get('/api/graph/routes?filters=publicStart,%20sinkEnd', {
      validateStatus: () => true,
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.nodes)).toBe(true);
    expect(Array.isArray(res.data.edges)).toBe(true);
  });

  it('mixed valid + invalid filter returns 400 listing the invalid name', async () => {
    const res = await axios.get('/api/graph/routes?filters=publicStart,unknown', {
      validateStatus: () => true,
    });
    expect(res.status).toBe(400);
    expect(res.data.message).toMatch(/unknown/);
    expect(res.data.message).toMatch(/Available/);
  });
});

// ─── GET /api/graph/routes — combined filters semantic correctness ─────────────

describe('GET /api/graph/routes — combined filters semantic correctness', () => {
  it('publicStart + sinkEnd: result has at least one public source node', async () => {
    const res = await axios.get('/api/graph/routes?filters=publicStart,sinkEnd');
    const nodes = res.data.nodes as AnyRecord[];
    const edges = res.data.edges as AnyRecord[];
    const hasIncoming = new Set(edges.map((e) => e['to']));
    const sources = nodes.filter((n) => !hasIncoming.has(n['name']));
    expect(sources.some((n) => n['publicExposed'] === true)).toBe(true);
  });

  it('publicStart + sinkEnd: result has at least one rds/sql sink node', async () => {
    const res = await axios.get('/api/graph/routes?filters=publicStart,sinkEnd');
    const nodes = res.data.nodes as AnyRecord[];
    const edges = res.data.edges as AnyRecord[];
    const hasOutgoing = new Set(edges.map((e) => e['from']));
    const sinks = nodes.filter((n) => !hasOutgoing.has(n['name']));
    expect(sinks.some((n) => n['kind'] === 'rds' || n['kind'] === 'sql')).toBe(true);
  });

  it('publicStart + hasVulnerability: result has public source AND vulnerable node', async () => {
    const res = await axios.get('/api/graph/routes?filters=publicStart,hasVulnerability');
    const nodes = res.data.nodes as AnyRecord[];
    const edges = res.data.edges as AnyRecord[];
    const hasIncoming = new Set(edges.map((e) => e['to']));
    const sources = nodes.filter((n) => !hasIncoming.has(n['name']));
    expect(sources.some((n) => n['publicExposed'] === true)).toBe(true);
    expect(
      nodes.some(
        (n) =>
          Array.isArray(n['vulnerabilities']) &&
          (n['vulnerabilities'] as unknown[]).length > 0,
      ),
    ).toBe(true);
  });

  it('sinkEnd + hasVulnerability: result has rds/sql sink AND vulnerable node', async () => {
    const res = await axios.get('/api/graph/routes?filters=sinkEnd,hasVulnerability');
    const nodes = res.data.nodes as AnyRecord[];
    const edges = res.data.edges as AnyRecord[];
    const hasOutgoing = new Set(edges.map((e) => e['from']));
    const sinks = nodes.filter((n) => !hasOutgoing.has(n['name']));
    expect(sinks.some((n) => n['kind'] === 'rds' || n['kind'] === 'sql')).toBe(true);
    expect(
      nodes.some(
        (n) =>
          Array.isArray(n['vulnerabilities']) &&
          (n['vulnerabilities'] as unknown[]).length > 0,
      ),
    ).toBe(true);
  });

  it('all 3 filters combined: result satisfies all 3 constraints simultaneously', async () => {
    const res = await axios.get(
      '/api/graph/routes?filters=publicStart,sinkEnd,hasVulnerability',
    );
    const nodes = res.data.nodes as AnyRecord[];
    const edges = res.data.edges as AnyRecord[];
    const hasIncoming = new Set(edges.map((e) => e['to']));
    const hasOutgoing = new Set(edges.map((e) => e['from']));
    const sources = nodes.filter((n) => !hasIncoming.has(n['name']));
    const sinks = nodes.filter((n) => !hasOutgoing.has(n['name']));
    expect(sources.some((n) => n['publicExposed'] === true)).toBe(true);
    expect(sinks.some((n) => n['kind'] === 'rds' || n['kind'] === 'sql')).toBe(true);
    expect(
      nodes.some(
        (n) =>
          Array.isArray(n['vulnerabilities']) &&
          (n['vulnerabilities'] as unknown[]).length > 0,
      ),
    ).toBe(true);
  });

  it('all 3 filters combined: edges reference only nodes in the result', async () => {
    const res = await axios.get(
      '/api/graph/routes?filters=publicStart,sinkEnd,hasVulnerability',
    );
    const nodeNames = new Set(
      (res.data.nodes as AnyRecord[]).map((n) => n['name']),
    );
    for (const edge of res.data.edges as AnyRecord[]) {
      expect(nodeNames.has(edge['from'])).toBe(true);
      expect(nodeNames.has(edge['to'])).toBe(true);
    }
  });
});

// ─── GET /api/graph/routes — publicStart semantic correctness ─────────────────

describe('GET /api/graph/routes?filters=publicStart — semantic correctness', () => {
  let nodes: AnyRecord[];
  let edges: AnyRecord[];

  beforeAll(async () => {
    const res = await axios.get('/api/graph/routes?filters=publicStart');
    nodes = res.data.nodes as AnyRecord[];
    edges = res.data.edges as AnyRecord[];
  });

  it('every source node (no incoming edges) has publicExposed === true', () => {
    const nodeNames = new Set(nodes.map((n) => n['name']));
    const hasIncoming = new Set(edges.map((e) => e['to']));
    const sources = nodes.filter((n) => !hasIncoming.has(n['name']));
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(source['publicExposed']).toBe(true);
    }
  });

  it('all edge "from" values reference a node in the result', () => {
    const nodeNames = new Set(nodes.map((n) => n['name']));
    for (const edge of edges) {
      expect(nodeNames.has(edge['from'])).toBe(true);
    }
  });

  it('all edge "to" values reference a node in the result', () => {
    const nodeNames = new Set(nodes.map((n) => n['name']));
    for (const edge of edges) {
      expect(nodeNames.has(edge['to'])).toBe(true);
    }
  });
});

// ─── GET /api/graph/routes — sinkEnd semantic correctness ─────────────────────

describe('GET /api/graph/routes?filters=sinkEnd — semantic correctness', () => {
  let nodes: AnyRecord[];
  let edges: AnyRecord[];

  beforeAll(async () => {
    const res = await axios.get('/api/graph/routes?filters=sinkEnd');
    nodes = res.data.nodes as AnyRecord[];
    edges = res.data.edges as AnyRecord[];
  });

  it('at least one sink node (no outgoing edges) has kind "rds" or "sql"', () => {
    const hasOutgoing = new Set(edges.map((e) => e['from']));
    const sinks = nodes.filter((n) => !hasOutgoing.has(n['name']));
    expect(sinks.length).toBeGreaterThan(0);
    expect(sinks.some((n) => n['kind'] === 'rds' || n['kind'] === 'sql')).toBe(true);
  });

  it('all edge "from" values reference a node in the result', () => {
    const nodeNames = new Set(nodes.map((n) => n['name']));
    for (const edge of edges) {
      expect(nodeNames.has(edge['from'])).toBe(true);
    }
  });

  it('all edge "to" values reference a node in the result', () => {
    const nodeNames = new Set(nodes.map((n) => n['name']));
    for (const edge of edges) {
      expect(nodeNames.has(edge['to'])).toBe(true);
    }
  });
});

// ─── GET /api/graph/routes — hasVulnerability semantic correctness ─────────────

describe('GET /api/graph/routes?filters=hasVulnerability — semantic correctness', () => {
  let nodes: AnyRecord[];
  let edges: AnyRecord[];

  beforeAll(async () => {
    const res = await axios.get('/api/graph/routes?filters=hasVulnerability');
    nodes = res.data.nodes as AnyRecord[];
    edges = res.data.edges as AnyRecord[];
  });

  it('vulnerability objects have a "file" string field', () => {
    const vulns = nodes.flatMap((n) =>
      Array.isArray(n['vulnerabilities']) ? (n['vulnerabilities'] as AnyRecord[]) : [],
    );
    expect(vulns.length).toBeGreaterThan(0);
    for (const v of vulns) {
      expect(typeof v['file']).toBe('string');
    }
  });

  it('vulnerability objects have a valid "severity" field', () => {
    const valid = new Set(['low', 'medium', 'high', 'critical']);
    const vulns = nodes.flatMap((n) =>
      Array.isArray(n['vulnerabilities']) ? (n['vulnerabilities'] as AnyRecord[]) : [],
    );
    for (const v of vulns) {
      expect(valid.has(v['severity'] as string)).toBe(true);
    }
  });

  it('vulnerability objects have a "message" string field', () => {
    const vulns = nodes.flatMap((n) =>
      Array.isArray(n['vulnerabilities']) ? (n['vulnerabilities'] as AnyRecord[]) : [],
    );
    for (const v of vulns) {
      expect(typeof v['message']).toBe('string');
    }
  });

  it('all edge "from" values reference a node in the result', () => {
    const nodeNames = new Set(nodes.map((n) => n['name']));
    for (const edge of edges) {
      expect(nodeNames.has(edge['from'])).toBe(true);
    }
  });

  it('all edge "to" values reference a node in the result', () => {
    const nodeNames = new Set(nodes.map((n) => n['name']));
    for (const edge of edges) {
      expect(nodeNames.has(edge['to'])).toBe(true);
    }
  });
});
