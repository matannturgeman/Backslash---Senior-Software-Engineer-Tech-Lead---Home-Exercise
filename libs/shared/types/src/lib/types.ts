// ─── Graph Types ──────────────────────────────────────────────────────────────

export type NodeKind = 'service' | 'rds' | 'sqs' | 'sql';

export interface Vulnerability {
  file: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metadata?: Record<string, unknown>;
}

export interface GraphNode {
  name: string;
  kind: NodeKind;
  publicExposed?: boolean;
  vulnerabilities?: Vulnerability[];
  language?: string;
  path?: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface CypherFilter {
  startWhere?: string;  // condition on the first node of the path
  endWhere?: string;    // condition on the last node of the path
  pathWhere?: string;   // condition on any node in the path
}
