declare interface D1Database {
  prepare(query: string): unknown;
  dump?(): Promise<ArrayBuffer>;
  batch?(statements: unknown[]): Promise<unknown[]>;
  exec?(query: string): Promise<unknown>;
}

declare interface Fetcher {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}

declare module "cloudflare:workers" {
  export const env: {
    DB?: D1Database;
  };
}
