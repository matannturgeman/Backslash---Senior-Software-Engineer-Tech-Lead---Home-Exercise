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
