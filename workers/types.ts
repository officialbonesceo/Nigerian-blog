/**
 * Cloudflare Workers & D1 Database Environment Definitions
 * Standalone TypeScript types for 9jaBeacon backend automation
 */

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<{ success: boolean; meta: any; results?: T[] }>;
  all<T = unknown>(): Promise<{ success: boolean; results: T[] }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface ScheduledController {
  scheduledTime: number;
  cron: string;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

export interface WorkerEnv {
  DB: D1Database;
  GROQ_API_KEY?: string;
  ADMIN_SECRET?: string;
  ENVIRONMENT?: string;
  SITE_URL?: string;
  SITE_NAME?: string;
}

export interface IngestItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  content?: string;
  author?: string;
  enclosureUrl?: string;
}
