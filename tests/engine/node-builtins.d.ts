declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
}

declare module 'node:path' {
  export function dirname(p: string): string;
  export function resolve(...paths: string[]): string;
  export function join(...paths: string[]): string;
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}

declare module 'node:vm' {
  export interface Context {}
  export function createContext(sandbox?: Record<string, unknown>): Context;
  export function runInContext(
    code: string,
    contextifiedObject: Context,
    options?: { filename?: string },
  ): unknown;
}
