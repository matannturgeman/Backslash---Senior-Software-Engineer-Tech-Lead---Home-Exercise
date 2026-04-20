import { z } from 'zod';
import {
  userSchema,
  createUserSchema,
  loginSchema,
  registerSchema,
  authResponseSchema,
} from '@libs/shared-validation-schemas';

// ─── User Types ───────────────────────────────────────────────────────────────

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;

export type UpdateUserInput = Partial<Pick<User, 'name'>>;

// ─── Auth Types ───────────────────────────────────────────────────────────────

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

// ─── HTTP Response wrapper ────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  statusCode: number;
  data?: T;
  message?: string;
  error?: string | null;
}

export type StatusCode = 200 | 201 | 400 | 401 | 403 | 404 | 409 | 500;

// ─── Product Types ────────────────────────────────────────────────────────────

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  createdAt: Date;
}

export type CreateProductInput = Omit<Product, 'id' | 'createdAt'>;
export type UpdateProductInput = Partial<CreateProductInput>;

// ─── Order Types ─────────────────────────────────────────────────────────────

export interface Order {
  id: number;
  userId: number;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  createdAt: Date;
}

export interface OrderItem {
  productId: number;
  quantity: number;
  unitPrice: number;
}

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export type CreateOrderInput = Omit<Order, 'id' | 'status' | 'createdAt'>;

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

export type Route = GraphNode[];

/** @deprecated — replaced by CypherFilter after Neo4j migration */
export type FilterFn = (route: Route) => boolean;

export interface CypherFilter {
  startWhere?: string;  // condition on the first node of the path
  endWhere?: string;    // condition on the last node of the path
  pathWhere?: string;   // condition on any node in the path
}
