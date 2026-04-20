import { Test } from '@nestjs/testing';
import { GraphLoader } from './graph.loader.js';
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
});
