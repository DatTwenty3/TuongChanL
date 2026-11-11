declare module 'node:fs' {
  export interface DirentEntry {
    name: string;
    isDirectory(): boolean;
  }
  export function readdirSync(
    path: string,
    options: { withFileTypes: true },
  ): DirentEntry[];
}

declare module 'node:zlib' {
  export function inflateRawSync(buf: Uint8Array): Uint8Array;
}
