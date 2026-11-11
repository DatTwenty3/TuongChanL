import {
  ancEnsure,
  calcEnsure,
  isD,
  mergeProject,
  type EngineProject,
} from '../engine';

export { mergeProject };

export function baseName(name?: string): string {
  const s = (name || 'tuong-chan')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^\w]+/g, '_')
    .slice(0, 40);
  return s || 'tuong-chan';
}

export function downloadFile(
  name: string,
  data: string | Blob | Uint8Array | ArrayBuffer,
  mime: string,
): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const blobData: BlobPart =
    data instanceof Blob
      ? data
      : typeof data === 'string'
        ? data
        : data instanceof ArrayBuffer
          ? data
          : new Uint8Array(data);
  const b = blobData instanceof Blob ? blobData : new Blob([blobData], { type: mime });
  const url = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 500);
}

export function serializeProject(P: EngineProject): string {
  return JSON.stringify({ app: 'tuong-chan-L', v: 1, p: P }, null, 1);
}

export function parseProjectFile(jsonText: string): EngineProject {
  const o = JSON.parse(jsonText) as { app?: string; v?: number; p?: Partial<EngineProject> & Record<string, unknown> };
  if (!o || typeof o !== 'object' || !o.p || typeof o.p !== 'object') {
    throw new Error('File dự án không hợp lệ.');
  }
  return mergeProject(o.p);
}

export async function openProjectFromFile(file: File): Promise<EngineProject> {
  const txt =
    typeof file.text === 'function'
      ? await file.text()
      : await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result || ''));
          r.onerror = () => reject(new Error('Không đọc được file dự án.'));
          r.readAsText(file);
        });
  return parseProjectFile(txt);
}

export function saveProjectFile(P: EngineProject): string {
  const filename = `${baseName(P.name)}.tcl.json`;
  downloadFile(filename, serializeProject(P), 'application/json');
  return filename;
}

export function setAnc(p: EngineProject, on: boolean): void {
  ancEnsure(p);
  p.anc!.on = Boolean(on);
  if (!on) return;
  const c = calcEnsure(p);
  c.soil = 'a';
  if (!isD(p) && !c.aSlSet) {
    c.aSl = 'dw';
    c.aOT = false;
  }
}
