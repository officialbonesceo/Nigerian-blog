/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
}

declare namespace App {
  interface Locals {
    runtime: {
      env: Env;
      cf: IncomingRequestCfProperties;
      caches: CacheStorage;
      ctx: ExecutionContext;
    };
  }
}
