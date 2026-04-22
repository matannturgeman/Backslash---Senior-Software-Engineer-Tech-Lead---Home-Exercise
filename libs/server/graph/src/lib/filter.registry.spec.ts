import { filterRegistry } from './filter.registry';

describe('filterRegistry', () => {
  describe('publicStart', () => {
    const filter = filterRegistry['publicStart'];

    it('has a startWhere condition', () => {
      expect(filter.startWhere).toBeDefined();
    });

    it('startWhere references publicExposed', () => {
      expect(filter.startWhere).toContain('publicExposed');
    });

    it('has no endWhere or pathWhere', () => {
      expect(filter.endWhere).toBeUndefined();
      expect(filter.pathWhere).toBeUndefined();
    });
  });

  describe('sinkEnd', () => {
    const filter = filterRegistry['sinkEnd'];

    it('has an endWhere condition', () => {
      expect(filter.endWhere).toBeDefined();
    });

    it('endWhere includes rds and sql', () => {
      expect(filter.endWhere).toContain('rds');
      expect(filter.endWhere).toContain('sql');
    });

    it('has no startWhere or pathWhere', () => {
      expect(filter.startWhere).toBeUndefined();
      expect(filter.pathWhere).toBeUndefined();
    });
  });

  describe('hasVulnerability', () => {
    const filter = filterRegistry['hasVulnerability'];

    it('has a pathWhere condition', () => {
      expect(filter.pathWhere).toBeDefined();
    });

    it('pathWhere checks hasVulnerability on any node', () => {
      expect(filter.pathWhere).toContain('hasVulnerability');
      expect(filter.pathWhere).toContain('any(');
    });

    it('has no startWhere or endWhere', () => {
      expect(filter.startWhere).toBeUndefined();
      expect(filter.endWhere).toBeUndefined();
    });
  });

  it('all registry entries are valid CypherFilter objects', () => {
    for (const [name, filter] of Object.entries(filterRegistry)) {
      expect(typeof name).toBe('string');
      const hasAtLeastOne =
        filter.startWhere !== undefined ||
        filter.endWhere !== undefined ||
        filter.pathWhere !== undefined;
      expect(hasAtLeastOne).toBe(true);
    }
  });
});
