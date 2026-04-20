import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import type { GraphEdge, GraphNode } from '@libs/shared-types';

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const vulnerabilitySchema = z.object({
  file: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  message: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const graphNodeSchema = z.object({
  name: z.string().min(1, 'Node name must not be empty'),
  kind: z.enum(['service', 'rds', 'sqs', 'sql']),
  publicExposed: z.boolean().optional(),
  vulnerabilities: z.array(vulnerabilitySchema).optional(),
  language: z.string().optional(),
  path: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const rawEdgeSchema = z.object({
  from: z.string().min(1, 'Edge "from" must not be empty'),
  to: z.union([z.string().min(1), z.array(z.string().min(1))]),
});

const rawGraphSchema = z.object({
  nodes: z.array(graphNodeSchema),
  edges: z.array(rawEdgeSchema),
});

// ─── Loader ───────────────────────────────────────────────────────────────────

@Injectable()
export class GraphLoader implements OnModuleInit {
  private readonly logger = new Logger(GraphLoader.name);

  nodes: Map<string, GraphNode> = new Map();
  edges: GraphEdge[] = [];
  fileHash = '';

  onModuleInit() {
    const filePath = join(__dirname, 'assets', 'train-ticket.json');
    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch (err) {
      throw new Error(`Failed to read graph file ${filePath}: ${(err as Error).message}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      throw new Error(`Graph file is not valid JSON: ${(err as Error).message}`);
    }

    const result = rawGraphSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `Graph file failed schema validation:\n${result.error.issues
          .map((i) => `  [${i.path.join('.')}] ${i.message}`)
          .join('\n')}`,
      );
    }

    const raw = result.data;
    this.fileHash = createHash('sha256').update(content).digest('hex');

    for (const node of raw.nodes) {
      this.nodes.set(node.name, node);
    }

    for (const edge of raw.edges) {
      const targets = Array.isArray(edge.to) ? edge.to : [edge.to];
      for (const target of targets) {
        this.edges.push({ from: edge.from, to: target });
      }
    }

    this.logger.log(
      `Graph loaded: ${this.nodes.size} nodes, ${this.edges.length} edges`,
    );
  }
}
