declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string, encoding: 'utf8' | 'utf-8'): string;
  export function readFileSync(path: string): Uint8Array;
  export function readdirSync(path: string): string[];
  export function statSync(path: string): { size: number; isDirectory(): boolean; isFile(): boolean };
  export function mkdirSync(path: string, opts?: { recursive?: boolean }): void;
  export function writeFileSync(path: string, data: string | Uint8Array): void;
}

declare module 'node:path' {
  export function resolve(...paths: string[]): string;
  export function join(...paths: string[]): string;
  export function dirname(p: string): string;
  export function basename(p: string, ext?: string): string;
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}

declare module 'node:crypto' {
  export interface Hash {
    update(data: string | Uint8Array): Hash;
    digest(encoding: 'hex' | 'base64'): string;
  }
  export function createHash(algorithm: 'sha256' | 'md5'): Hash;
}

declare module 'node:vm' {
  export interface Context extends Record<string, unknown> {}
  export function createContext(contextObject?: Record<string, unknown>): Context;
  export function runInContext(code: string, contextifiedObject: Context, options?: { filename?: string }): unknown;
}
