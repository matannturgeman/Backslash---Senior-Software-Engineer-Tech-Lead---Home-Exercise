import { Test } from '@nestjs/testing';
import { Neo4jService } from './neo4j.service';
import { NEO4J_DRIVER } from './neo4j.constants';

const mockSession = {
  run:          jest.fn(),
  executeWrite: jest.fn(),
  close:        jest.fn().mockResolvedValue(undefined),
};

const mockDriver = {
  session: jest.fn().mockReturnValue(mockSession),
  close:   jest.fn().mockResolvedValue(undefined),
};

describe('Neo4jService', () => {
  let service: Neo4jService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDriver.session.mockReturnValue(mockSession);
    mockSession.close.mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        Neo4jService,
        { provide: NEO4J_DRIVER, useValue: mockDriver },
      ],
    }).compile();

    service = module.get(Neo4jService);
  });

  // ─── run ────────────────────────────────────────────────────────────────────

  describe('run', () => {
    it('returns the query result', async () => {
      const result = { records: [{ get: () => 'value' }] };
      mockSession.run.mockResolvedValue(result);

      await expect(service.run('RETURN 1')).resolves.toBe(result);
      expect(mockSession.run).toHaveBeenCalledWith('RETURN 1', {});
    });

    it('forwards params to session.run', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await service.run('MATCH (n {name: $name}) RETURN n', { name: 'svc-a' });

      expect(mockSession.run).toHaveBeenCalledWith(
        'MATCH (n {name: $name}) RETURN n',
        { name: 'svc-a' },
      );
    });

    it('closes the session after a successful query', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await service.run('RETURN 1');

      expect(mockSession.close).toHaveBeenCalledTimes(1);
    });

    it('closes the session even when the query throws', async () => {
      mockSession.run.mockRejectedValue(new Error('connection refused'));

      await expect(service.run('RETURN 1')).rejects.toThrow('connection refused');
      expect(mockSession.close).toHaveBeenCalledTimes(1);
    });

    it('opens a new session per call', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await service.run('RETURN 1');
      await service.run('RETURN 2');

      expect(mockDriver.session).toHaveBeenCalledTimes(2);
    });
  });

  // ─── writeTransaction ────────────────────────────────────────────────────────

  describe('writeTransaction', () => {
    it('executes the callback inside a write transaction', async () => {
      const fn = jest.fn().mockResolvedValue(undefined);
      mockSession.executeWrite.mockImplementation((cb: typeof fn) => cb());

      await service.writeTransaction(fn);

      expect(mockSession.executeWrite).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('closes the session after a successful transaction', async () => {
      mockSession.executeWrite.mockResolvedValue(undefined);

      await service.writeTransaction(jest.fn());

      expect(mockSession.close).toHaveBeenCalledTimes(1);
    });

    it('closes the session even when the transaction throws', async () => {
      mockSession.executeWrite.mockRejectedValue(new Error('write failed'));

      await expect(service.writeTransaction(jest.fn())).rejects.toThrow('write failed');
      expect(mockSession.close).toHaveBeenCalledTimes(1);
    });
  });

  // ─── onModuleDestroy ─────────────────────────────────────────────────────────

  describe('onModuleDestroy', () => {
    it('closes the driver', async () => {
      await service.onModuleDestroy();
      expect(mockDriver.close).toHaveBeenCalledTimes(1);
    });
  });
});
