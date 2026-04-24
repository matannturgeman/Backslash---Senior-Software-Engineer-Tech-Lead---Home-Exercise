import { Test } from '@nestjs/testing';
import { GraphLoader } from './graph.loader';
import * as fs from 'fs';

jest.mock('fs');
const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

const MOCK_JSON = JSON.stringify({
  nodes: [
    { name: 'svc-a', kind: 'service', publicExposed: true },
    { name: 'svc-b', kind: 'service', publicExposed: false },
    { name: 'db', kind: 'rds' },
  ],
  edges: [
    { from: 'svc-a', to: 'svc-b' },
    { from: 'svc-b', to: ['db'] },
  ],
});

describe('GraphLoader', () => {
  let loader: GraphLoader;

  beforeEach(async () => {
    mockReadFileSync.mockReturnValue(MOCK_JSON);
    const module = await Test.createTestingModule({
      providers: [GraphLoader],
    }).compile();
    loader = module.get(GraphLoader);
    loader.onModuleInit();
  });

  it('loads all nodes into map', () => {
    expect(loader.nodes.size).toBe(3);
    expect(loader.nodes.get('svc-a')?.publicExposed).toBe(true);
    expect(loader.nodes.get('db')?.kind).toBe('rds');
  });

  it('normalizes array edges to flat list', () => {
    expect(loader.edges).toEqual([
      { from: 'svc-a', to: 'svc-b' },
      { from: 'svc-b', to: 'db' },
    ]);
  });

  it('throws when readFileSync fails', async () => {
    mockReadFileSync.mockImplementation(() => { throw new Error('ENOENT: no such file'); });
    const m = await Test.createTestingModule({ providers: [GraphLoader] }).compile();
    const errLoader = m.get(GraphLoader);
    expect(() => errLoader.onModuleInit()).toThrow('Failed to read graph file');
  });

  it('throws when file content is not valid JSON', async () => {
    mockReadFileSync.mockReturnValue('not { valid json {{');
    const m = await Test.createTestingModule({ providers: [GraphLoader] }).compile();
    const errLoader = m.get(GraphLoader);
    expect(() => errLoader.onModuleInit()).toThrow('Graph file is not valid JSON');
  });

  it('throws when JSON fails schema validation', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({
      nodes: [{ name: '', kind: 'unknown-kind' }],
      edges: [],
    }));
    const m = await Test.createTestingModule({ providers: [GraphLoader] }).compile();
    const errLoader = m.get(GraphLoader);
    expect(() => errLoader.onModuleInit()).toThrow('Graph file failed schema validation');
  });
});
