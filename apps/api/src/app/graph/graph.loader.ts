import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { GraphNode, GraphEdge } from '@libs/shared-types';

interface RawEdge {
  from: string;
  to: string | string[];
}

interface RawGraph {
  nodes: GraphNode[];
  edges: RawEdge[];
}

@Injectable()
export class GraphLoader implements OnModuleInit {
  private readonly logger = new Logger(GraphLoader.name);

  nodes: Map<string, GraphNode> = new Map();
  edges: GraphEdge[] = [];
  fileHash = '';

  onModuleInit() {
    const filePath = join(__dirname, 'assets', 'train-ticket.json');
    let content: string;
    let raw: RawGraph;
    try {
      content = readFileSync(filePath, 'utf-8');
      raw = JSON.parse(content);
    } catch (err) {
      throw new Error(`Failed to load graph data from ${filePath}: ${(err as Error).message}`);
    }

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
