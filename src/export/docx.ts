import {
  calcEnsureAll,
  calcRun,
  type CalcRunResult,
  type CalcValidResult,
  type EngineProject,
} from '../engine';
import { calcSheetHTML } from '../reports/calcSheetHtml';
import { TEX_FN, TEX_SYM, texToHtml, texTokens, type TexToken } from '../reports/texToHtml';

const _zCrcT: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function zCrc32(u8: Uint8Array): number {
  let c = 4294967295;
  for (let i = 0; i < u8.length; i++) c = _zCrcT[(c ^ u8[i]) & 255] ^ (c >>> 8);
  return (c ^ 4294967295) >>> 0;
}

export async function zDeflate(u8: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw');
  const readPromise = new Response(cs.readable).arrayBuffer();
  const w = cs.writable.getWriter();
  const writePromise = (async () => {
    await w.write(new Uint8Array(u8));
    await w.close();
  })();
  const [ab] = await Promise.all([readPromise, writePromise]);
  return new Uint8Array(ab);
}

export interface ZipEntryInput {
  n: string;
  d: string | Uint8Array;
  store?: boolean;
}

export async function zipBuild(files: readonly ZipEntryInput[]): Promise<Blob> {
  const enc = new TextEncoder();
  const parts: BlobPart[] = [];
  const cen: BlobPart[] = [];
  let off = 0;
  const u16 = (v: number): [number, number] => [v & 255, (v >>> 8) & 255];
  const u32 = (v: number): [number, number, number, number] => [
    v & 255,
    (v >>> 8) & 255,
    (v >>> 16) & 255,
    (v >>> 24) & 255,
  ];

  for (const f of files) {
    const nm = enc.encode(f.n);
    const raw = typeof f.d === 'string' ? enc.encode(f.d) : f.d;
    const crc = zCrc32(raw);
    let data = raw;
    let method = 0;
    if (!f.store && raw.length > 200 && typeof CompressionStream !== 'undefined') {
      try {
        const z = await zDeflate(raw);
        if (z.length < raw.length) {
          data = z;
          method = 8;
        }
      } catch {
        // Ignore deflate failure and store uncompressed
      }
    }
    const lh = new Uint8Array([
      80,
      75,
      3,
      4,
      ...u16(20),
      ...u16(2048),
      ...u16(method),
      ...u16(0),
      ...u16(33),
      ...u32(crc),
      ...u32(data.length),
      ...u32(raw.length),
      ...u16(nm.length),
      ...u16(0),
    ]);
    parts.push(lh, new Uint8Array(nm), new Uint8Array(data));
    cen.push(
      new Uint8Array([
        80,
        75,
        1,
        2,
        ...u16(20),
        ...u16(20),
        ...u16(2048),
        ...u16(method),
        ...u16(0),
        ...u16(33),
        ...u32(crc),
        ...u32(data.length),
        ...u32(raw.length),
        ...u16(nm.length),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u32(0),
        ...u32(off),
      ]),
      new Uint8Array(nm),
    );
    off += lh.length + nm.length + data.length;
  }

  let cs = 0;
  cen.forEach((c) => {
    cs += (c as Uint8Array).length;
  });
  const end = new Uint8Array([
    80,
    75,
    5,
    6,
    ...u16(0),
    ...u16(0),
    ...u16(files.length),
    ...u16(files.length),
    ...u32(cs),
    ...u32(off),
    ...u16(0),
  ]);
  return new Blob([...parts, ...cen, end], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

const dxE = (s: unknown): string =>
  // eslint-disable-next-line no-control-regex
  String(s)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export function omRun(t: string, k?: string): string {
  if (t === '') return '';
  const pr =
    k === 'p'
      ? '<m:rPr><m:sty m:val="p"/></m:rPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr>'
      : k === 'b'
        ? '<m:rPr><m:sty m:val="b"/></m:rPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr>'
        : k === 'nor'
          ? '<m:rPr><m:nor/></m:rPr><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr>'
          : '<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr>';
  return `<m:r>${pr}<m:t xml:space="preserve">${dxE(t)}</m:t></m:r>`;
}

const OM_SPC: Record<string, string> = {
  quad: ' ',
  qquad: '  ',
  ';': ' ',
  ':': ' ',
  ',': ' ',
  ' ': ' ',
  '!': '',
};

interface OmNode {
  r?: string;
  k?: string;
  x?: string;
}

export function omParse(src: string): string {
  const T = texTokens(String(src));
  let pos = 0;
  const Rn = (t: string, k?: string): OmNode => ({ r: t, k });
  const Xn = (s: string): OmNode => ({ x: s });
  const nodeXml = (n: OmNode): string => (n.x !== undefined ? n.x : omRun(n.r || '', n.k));
  const merge = (arr: OmNode[]): OmNode[] => {
    const o: OmNode[] = [];
    for (const n of arr) {
      const l = o[o.length - 1];
      if (n.r !== undefined && l && l.r !== undefined && l.k === n.k) l.r += n.r;
      else o.push(Object.assign({}, n));
    }
    return o;
  };
  const xml = (arr: OmNode[]): string => merge(arr).map(nodeXml).join('');
  const dl = (d?: TexToken): string => {
    if (!d) return '';
    if (d.k === 'ch') return d.v === '.' ? '' : d.v || '';
    if (d.k === 'cmd' && d.v) return TEX_SYM[d.v] !== undefined ? TEX_SYM[d.v] : '';
    return '';
  };

  function raw(): string {
    if (!T[pos] || T[pos].k !== '{') {
      const t = T[pos++];
      return t ? t.v || '' : '';
    }
    pos++;
    let d = 1;
    let s = '';
    while (pos < T.length && d > 0) {
      const t = T[pos++];
      if (t.k === '{') {
        d++;
        s += '{';
      } else if (t.k === '}') {
        d--;
        if (d > 0) s += '}';
      } else if (t.k === 'cmd' && t.v) {
        s +=
          TEX_SYM[t.v] !== undefined
            ? TEX_SYM[t.v]
            : t.v === ',' || t.v === ';' || t.v === ' '
              ? ' '
              : '';
      } else if (t.k === 'ch') {
        s += t.v || '';
      } else {
        s += t.k;
      }
    }
    return s;
  }

  function group(sty?: string): OmNode[] {
    const t = T[pos];
    if (!t) return [];
    if (t.k === '{') {
      pos++;
      const a = seq(true, false, sty);
      if (T[pos] && T[pos].k === '}') pos++;
      return a;
    }
    return atom(sty);
  }

  function atom(sty?: string): OmNode[] {
    const t = T[pos++];
    if (!t) return [];
    if (t.k === '{') {
      pos--;
      return group(sty);
    }
    if (t.k === 'ch') {
      const c = t.v || '';
      if (c === ' ') return [];
      if (c === "'") return [Rn('′', 'p')];
      if (c === '-') return [Rn('−', sty)];
      return [Rn(c, sty)];
    }
    if (t.k === 'cmd' && t.v) return cmd(t.v, sty);
    return [];
  }

  function cmd(v: string, sty?: string): OmNode[] {
    if (v === 'dfrac' || v === 'frac' || v === 'tfrac') {
      const a = group(sty);
      const b = group(sty);
      return [Xn(`<m:f><m:num>${xml(a)}</m:num><m:den>${xml(b)}</m:den></m:f>`)];
    }
    if (v === 'sqrt') {
      const a = group(sty);
      return [
        Xn(`<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${xml(a)}</m:e></m:rad>`),
      ];
    }
    if (v === 'text' || v === 'textrm' || v === 'mbox') return [Rn(raw(), 'nor')];
    if (v === 'mathrm') return [Rn(raw(), 'p')];
    if (v === 'mathbf' || v === 'textbf' || v === 'boldsymbol') return group('b');
    if (v === 'overline' || v === 'bar') {
      const a = group(sty);
      return [Xn(`<m:bar><m:barPr><m:pos m:val="top"/></m:barPr><m:e>${xml(a)}</m:e></m:bar>`)];
    }
    if (v === 'left') {
      const op = dl(T[pos++]);
      const inner = seq(false, true, sty);
      let cl = '';
      if (T[pos] && T[pos].k === 'cmd' && T[pos].v === 'right') {
        pos++;
        cl = dl(T[pos++]);
      }
      return [
        Xn(
          `<m:d><m:dPr><m:begChr m:val="${dxE(op)}"/><m:endChr m:val="${dxE(cl)}"/></m:dPr><m:e>${xml(inner)}</m:e></m:d>`,
        ),
      ];
    }
    if (v === 'right' || v === 'big' || v === 'Big' || v === 'bigg' || v === 'Bigg') {
      const d = dl(T[pos++]);
      return d ? [Rn(d, 'p')] : [];
    }
    if (v === '\\') return [Rn(' ', 'nor')];
    if (OM_SPC[v] !== undefined) return OM_SPC[v] ? [Rn(OM_SPC[v], 'nor')] : [];
    if (TEX_FN.has(v)) {
      const nx = T[pos];
      const sp =
        nx &&
        !(nx.k === 'ch' && (nx.v === '(' || nx.v === ' ')) &&
        !(nx.k === 'cmd' && nx.v === 'left') &&
        !(nx.k === '_' || nx.k === '^');
      return sp ? [Rn(v, 'p'), Rn(' ', 'nor')] : [Rn(v, 'p')];
    }
    if (TEX_SYM[v] !== undefined) {
      const r = TEX_SYM[v];
      return [Rn(r === '&amp;' ? '&' : r, /^[•·×±∓]$/.test(r) ? 'p' : sty)];
    }
    return [];
  }

  function scripts(out: OmNode[], base: OmNode[]): void {
    let sub: OmNode[] | null = null;
    let sup: OmNode[] | null = null;
    while (T[pos] && (T[pos].k === '^' || T[pos].k === '_')) {
      const k = T[pos++].k;
      const g = group();
      if (k === '^') sup = g;
      else sub = g;
    }
    if (base.length === 1 && base[0].r === '′' && sub && !sup && out.length) {
      const prev = out.pop()!;
      out.push(
        Xn(
          `<m:sSubSup><m:e>${xml([prev])}</m:e><m:sub>${xml(sub)}</m:sub><m:sup>${xml(base)}</m:sup></m:sSubSup>`,
        ),
      );
      return;
    }
    const e = `<m:e>${xml(base)}</m:e>`;
    if (sub && sup) {
      out.push(Xn(`<m:sSubSup>${e}<m:sub>${xml(sub)}</m:sub><m:sup>${xml(sup)}</m:sup></m:sSubSup>`));
    } else if (sup) {
      out.push(Xn(`<m:sSup>${e}<m:sup>${xml(sup)}</m:sup></m:sSup>`));
    } else if (sub) {
      out.push(Xn(`<m:sSub>${e}<m:sub>${xml(sub)}</m:sub></m:sSub>`));
    } else {
      out.push(...base);
    }
  }

  function seq(inBrace: boolean, stopRight: boolean, sty?: string): OmNode[] {
    const out: OmNode[] = [];
    while (pos < T.length) {
      const t = T[pos];
      if (t.k === '}') {
        if (inBrace) break;
        pos++;
        continue;
      }
      if (stopRight && t.k === 'cmd' && t.v === 'right') break;
      if (t.k === '^' || t.k === '_') {
        scripts(out, [Rn('', sty)]);
        continue;
      }
      const a = atom(sty);
      if (T[pos] && (T[pos].k === '^' || T[pos].k === '_')) scripts(out, a);
      else out.push(...a);
    }
    return out;
  }

  return xml(seq(false, false, undefined));
}

export function omPieces(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let lr = 0;
  let last = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '\\') {
      const m = /^\\([A-Za-z]+)/.exec(s.slice(i, i + 12));
      if (m) {
        if (m[1] === 'left') lr++;
        else if (m[1] === 'right') lr--;
        else if (m[1] === 'quad' && depth === 0 && lr === 0) {
          out.push(s.slice(last, i));
          last = i + 5;
        }
        i += m[0].length - 1;
      } else {
        i++;
      }
    }
  }
  out.push(s.slice(last));
  return out.map((x) => x.trim()).filter((x) => x.length > 0);
}

export function omLines(tex: string): string[] {
  const pcs = omPieces(String(tex));
  const len = (t: string) => texToHtml(t).replace(/<[^>]+>/g, '').length;
  const strip = (t: string) => t.replace(/(\\\s*;|;|\\,|\\\s)+\s*$/, '').trim();
  const lines: string[] = [];
  let cur = '';
  let curLen = 0;
  for (const p of pcs) {
    const l = len(p);
    if (cur && curLen + l + 4 > 85) {
      lines.push(strip(cur));
      cur = p;
      curLen = l;
    } else {
      cur = cur ? cur + String.raw`\quad ` + p : p;
      curLen += l + 4;
    }
  }
  if (cur) lines.push(strip(cur));
  return lines.filter((x) => x.length > 0);
}

export const DX_W = 9637;

export interface DxRunStyle {
  b?: boolean;
  i?: boolean;
  c?: string;
  sz?: number;
  va?: 'subscript' | 'superscript';
}

export function dxRun(t: string, st: DxRunStyle): string {
  const rp =
    (st.b ? '<w:b/><w:bCs/>' : '') +
    (st.i ? '<w:i/><w:iCs/>' : '') +
    (st.c ? `<w:color w:val="${st.c}"/>` : '') +
    (st.sz ? `<w:sz w:val="${st.sz}"/><w:szCs w:val="${st.sz}"/>` : '') +
    (st.va ? `<w:vertAlign w:val="${st.va}"/>` : '');
  return `<w:r>${rp ? `<w:rPr>${rp}</w:rPr>` : ''}<w:t xml:space="preserve">${dxE(t)}</w:t></w:r>`;
}

export function dxRuns(node: Node, st: DxRunStyle): string {
  let o = '';
  for (const c of Array.from(node.childNodes)) {
    if (c.nodeType === 3) {
      const t = (c.nodeValue || '').replace(/[ \t\r\n\f]+/g, ' ');
      if (t) o += dxRun(t, st);
    } else if (c.nodeType === 1) {
      const elNode = c as Element;
      const tg = elNode.tagName;
      const ns: DxRunStyle = Object.assign({}, st);
      if (tg === 'I' || tg === 'EM') ns.i = true;
      else if (tg === 'B' || tg === 'STRONG') ns.b = true;
      else if (tg === 'SUB') ns.va = 'subscript';
      else if (tg === 'SUP') ns.va = 'superscript';
      else if (tg === 'BR') {
        o += '<w:r><w:br/></w:r>';
        continue;
      } else if (tg === 'SPAN') {
        if (elNode.classList.contains('ok')) {
          ns.b = true;
          ns.c = '006B2D';
        } else if (elNode.classList.contains('bad')) {
          ns.b = true;
          ns.c = 'C00000';
        }
      }
      o += dxRuns(c, ns);
    }
  }
  return o;
}

export interface DxParaOpts {
  style?: string;
  keepNext?: boolean;
  keepLines?: boolean;
  sp?: [number, number] | [number, number, number];
  ind?: number;
  jc?: 'left' | 'center' | 'right';
}

export function dxPara(inner: string, o: DxParaOpts = {}): string {
  const pp =
    (o.style ? `<w:pStyle w:val="${o.style}"/>` : '') +
    (o.keepNext ? '<w:keepNext/>' : '') +
    (o.keepLines ? '<w:keepLines/>' : '') +
    (o.sp
      ? `<w:spacing w:before="${o.sp[0]}" w:after="${o.sp[1]}"${o.sp[2] ? ` w:line="${o.sp[2]}" w:lineRule="auto"` : ''}/>`
      : '') +
    (o.ind != null ? `<w:ind w:left="${o.ind}"/>` : '') +
    (o.jc ? `<w:jc w:val="${o.jc}"/>` : '');
  return `<w:p>${pp ? `<w:pPr>${pp}</w:pPr>` : ''}${inner}</w:p>`;
}

const dxTxt = (el: Node, st?: DxRunStyle): string => dxRuns(el, st || {});

const dxGap = (tw: number): string =>
  `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${tw}" w:lineRule="exact"/></w:pPr></w:p>`;

export function dxTable(tb: Element): string {
  const rows = Array.from(tb.querySelectorAll('tr'));
  const cells = rows.map((r) => Array.from(r.children));
  const nc = Math.max(1, ...cells.map((r) => r.length));
  const txt = (c: Element) => (c.textContent || '').replace(/\s+/g, ' ').trim();
  const wt = Array<number>(nc).fill(4);
  cells.forEach((r, ri) =>
    r.forEach((c, i) => {
      const t = txt(c);
      const len =
        ri === 0
          ? Math.max(...t.split(' ').map((w) => w.length), t.length * 0.45)
          : Math.max(t.length, /Không đạt/.test(t) ? 11 : 0);
      wt[i] = Math.max(wt[i], Math.min(len, 38));
    }),
  );
  const sum = wt.reduce((a, b) => a + b, 0);
  const minW = Math.min(620, Math.floor(DX_W / nc));
  let ws = wt.map((w) => Math.max(minW, Math.round((DX_W * w) / sum)));
  const tot = ws.reduce((a, b) => a + b, 0);
  ws = ws.map((w) => Math.round((w * DX_W) / tot));
  ws[ws.length - 1] += DX_W - ws.reduce((a, b) => a + b, 0);

  const sz = nc <= 4 ? 21 : nc <= 6 ? 20 : nc <= 8 ? 19 : 18;
  const bd = (n: string) => `<w:${n} w:val="single" w:sz="4" w:space="0" w:color="9AA3A9"/>`;
  let x =
    `<w:tbl><w:tblPr><w:tblW w:w="${DX_W}" w:type="dxa"/><w:jc w:val="center"/>` +
    `<w:tblBorders>${bd('top')}${bd('left')}${bd('bottom')}${bd('right')}${bd('insideH')}${bd('insideV')}</w:tblBorders>` +
    `<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="57" w:type="dxa"/><w:right w:w="57" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
    `<w:tblGrid>${ws.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;

  cells.forEach((r, ri) => {
    x += `<w:tr><w:trPr><w:cantSplit/>${ri === 0 ? '<w:tblHeader/>' : ''}</w:trPr>`;
    for (let i = 0; i < nc; i++) {
      const c = r[i];
      if (!c) {
        x += `<w:tc><w:tcPr><w:tcW w:w="${ws[i]}" w:type="dxa"/></w:tcPr><w:p/></w:tc>`;
        continue;
      }
      const head = ri === 0 || c.tagName === 'TH';
      const jc: 'left' | 'center' | 'right' = head
        ? 'center'
        : c.classList.contains('l')
          ? 'left'
          : c.classList.contains('c')
            ? 'center'
            : 'right';
      x +=
        `<w:tc><w:tcPr><w:tcW w:w="${ws[i]}" w:type="dxa"/>${head ? '<w:shd w:val="clear" w:color="auto" w:fill="DBE5F1"/>' : ''}<w:vAlign w:val="center"/></w:tcPr>` +
        `${dxPara(dxTxt(c, { sz, b: head }), { sp: [20, 20], jc, keepNext: ri < rows.length - 1 && rows.length <= 8 })}</w:tc>`;
    }
    x += '</w:tr>';
  });
  return x + '</w:tbl>' + dxGap(120);
}

export function dxGrid(rows: readonly Element[]): string {
  const ws = [660, 3250, 1150, 2000, 950, 1627];
  let x =
    `<w:tbl><w:tblPr><w:tblW w:w="${DX_W}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="40" w:type="dxa"/><w:right w:w="40" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
    `<w:tblGrid>${ws.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
  const cell = (w: number, inner: string, jc: 'left' | 'center' | 'right', span?: number) =>
    `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${span ? `<w:gridSpan w:val="${span}"/>` : ''}<w:vAlign w:val="center"/></w:tcPr>${dxPara(inner, { sp: [10, 10], jc })}</w:tc>`;

  rows.forEach((r) => {
    const s = Array.from(r.children);
    const vt = r.querySelector('.vt');
    x += '<w:tr><w:trPr><w:cantSplit/></w:trPr>' + cell(ws[0], '', 'left');
    x += cell(ws[1], s[1] ? dxTxt(s[1], { sz: 21 }) : '', 'left');
    x += cell(ws[2], s[2] ? dxTxt(s[2], { sz: 21, i: true }) : '', 'right');
    if (vt) {
      x += cell(ws[3] + ws[4] + ws[5], dxTxt(vt, { sz: 21, b: true }), 'left', 3);
    } else {
      x +=
        cell(ws[3], s[3] ? dxTxt(s[3], { sz: 21 }) : '', 'right') +
        cell(ws[4], s[4] ? dxTxt(s[4], { sz: 21 }) : '', 'left') +
        cell(ws[5], s[5] ? dxTxt(s[5], { sz: 21, b: true }) : '', 'left');
    }
    x += '</w:tr>';
  });
  return x + '</w:tbl>' + dxGap(80);
}

// 1x1 transparent PNG fallback used only in non-rendering headless DOM environments (e.g. jsdom)
const PNG_1X1 = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0,
  0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 248, 255, 255, 63, 0, 5, 254, 2,
  254, 167, 53, 129, 132, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
]);

export async function dxSvgPng(
  svg: Element,
  W: number,
  H: number,
  sc: number,
): Promise<{ d: Uint8Array; ext: 'jpg' | 'png' }> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return { d: PNG_1X1, ext: 'png' };
  }
  const s = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([s], { type: 'image/svg+xml;charset=utf-8' }));
  const jpg = Array.from(svg.querySelectorAll('image')).some((im) =>
    /^data:image\/jpeg/.test(im.getAttribute('href') || im.getAttribute('xlink:href') || ''),
  );
  try {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(W * sc));
    cv.height = Math.max(1, Math.round(H * sc));
    const cx = cv.getContext('2d');
    if (!cx) return { d: PNG_1X1, ext: 'png' };
    const img = new Image();
    await new Promise<void>((ok, no) => {
      img.onload = () => ok();
      img.onerror = () => no(new Error('Không dựng được hình'));
      img.src = url;
    });
    cx.fillStyle = '#fff';
    cx.fillRect(0, 0, cv.width, cv.height);
    cx.drawImage(img, 0, 0, cv.width, cv.height);
    const blob = await new Promise<Blob | null>((ok) =>
      cv.toBlob(ok, jpg ? 'image/jpeg' : 'image/png', 0.9),
    );
    if (!blob) return { d: PNG_1X1, ext: 'png' };
    return { d: new Uint8Array(await blob.arrayBuffer()), ext: jpg ? 'jpg' : 'png' };
  } catch {
    return { d: PNG_1X1, ext: 'png' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function dxPicture(
  rid: string,
  id: number,
  cx: number,
  cy: number,
  name: string,
): string {
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="${dxE(name)}" descr="${dxE(name)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${dxE(name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

const DX_NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
const DX_HDR = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

export function dxStyles(): string {
  const ps = (id: string, nm: string, ppr: string, rpr: string, extra?: string) =>
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${nm}"/><w:basedOn w:val="Normal"/>${extra || ''}<w:qFormat/>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}</w:style>`;
  return (
    DX_HDR +
    `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="vi-VN" w:eastAsia="vi-VN" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>` +
    `<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/><w:unhideWhenUsed/></w:style>` +
    `<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>` +
    `<w:style w:type="numbering" w:default="1" w:styleId="NoList"><w:name w:val="No List"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/></w:style>` +
    ps(
      'Title',
      'Title',
      '<w:keepNext/><w:spacing w:before="0" w:after="160"/><w:jc w:val="center"/>',
      '<w:b/><w:bCs/><w:sz w:val="28"/><w:szCs w:val="28"/>',
      '<w:next w:val="Normal"/>',
    ) +
    ps(
      'Heading1',
      'heading 1',
      '<w:keepNext/><w:keepLines/><w:spacing w:before="260" w:after="80"/><w:outlineLvl w:val="0"/>',
      '<w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/>',
      '<w:next w:val="Normal"/>',
    ) +
    ps(
      'Heading2',
      'heading 2',
      '<w:keepNext/><w:keepLines/><w:spacing w:before="140" w:after="60"/><w:outlineLvl w:val="1"/>',
      '<w:sz w:val="22"/><w:szCs w:val="22"/>',
      '<w:next w:val="Normal"/>',
    ) +
    ps(
      'Footer',
      'footer',
      '<w:spacing w:after="0"/><w:jc w:val="center"/>',
      '<w:sz w:val="18"/><w:szCs w:val="18"/>',
    ) +
    '</w:styles>'
  );
}

export const dxSettings = (): string =>
  DX_HDR +
  `<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:zoom w:percent="100"/><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat><m:mathPr><m:mathFont m:val="Cambria Math"/><m:brkBin m:val="before"/><m:brkBinSub m:val="--"/><m:smallFrac m:val="0"/><m:dispDef/><m:lMargin m:val="0"/><m:rMargin m:val="0"/><m:defJc m:val="left"/><m:wrapIndent m:val="1440"/><m:intLim m:val="subSup"/><m:naryLim m:val="undOvr"/></m:mathPr><w:themeFontLang w:val="vi-VN"/></w:settings>`;

export const dxFooter = (): string =>
  DX_HDR +
  `<w:ftr ${DX_NS}><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr><w:r><w:t xml:space="preserve">Trang </w:t></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r><w:r><w:t xml:space="preserve"> / </w:t></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> NUMPAGES </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;

export function dxFormula(fx: Element | null): string {
  if (!fx) return '';
  const tex = fx.getAttribute('data-tex');
  if (!tex) return dxPara(dxTxt(fx, { i: true }), { ind: 990, sp: [40, 40] });
  const maths = omLines(tex)
    .map((l) => `<m:oMath>${omParse(l)}</m:oMath>`)
    .join('');
  return `<w:p><w:pPr><w:keepLines/><w:spacing w:before="40" w:after="40"/><w:ind w:left="990"/></w:pPr><m:oMathPara><m:oMathParaPr><m:jc m:val="left"/></m:oMathParaPr>${maths}</m:oMathPara></w:p>`;
}

export async function calcDocxBlob(P: EngineProject, R: CalcRunResult): Promise<Blob> {
  const html = calcSheetHTML(P, R);
  const dom = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const kids = Array.from(dom.body.children);
  const imgs: Array<{ d: Uint8Array; ext: 'jpg' | 'png' }> = [];
  let body = '';
  let grid: Element[] = [];
  let title = 'Bảng tính kiểm toán tường chắn';

  const flush = () => {
    if (grid.length) {
      body += dxGrid(grid);
      grid = [];
    }
  };

  for (const e of kids) {
    const tg = e.tagName;
    const cl = e.classList;
    if (tg === 'DIV' && cl.contains('cr') && !cl.contains('f') && e.children.length >= 4) {
      grid.push(e);
      continue;
    }
    flush();
    if (tg === 'H1') {
      title = (e.textContent || '').trim();
      body += dxPara(dxTxt(e, {}), { style: 'Title' });
    } else if (tg === 'H2') {
      body += dxPara(dxTxt(e, {}), { style: 'Heading1' });
    } else if (tg === 'H3') {
      body += dxPara(dxTxt(e, {}), { style: 'Heading2' });
    } else if (tg === 'TABLE') {
      body += dxTable(e);
    } else if (tg === 'DIV' && cl.contains('f')) {
      body += dxFormula(e.querySelector('.fx'));
    } else if (tg === 'DIV' && cl.contains('cr')) {
      const last = e.children[e.children.length - 1];
      if (last) body += dxPara(dxTxt(last, {}), { ind: 700, sp: [20, 40] });
    } else if (tg === 'DIV' && cl.contains('figw')) {
      const svg = e.querySelector('svg');
      if (!svg) continue;
      const vb = (svg.getAttribute('viewBox') || '0 0 600 400').split(/\s+/).map(Number);
      const W = vb[2] || 600;
      const H = vb[3] || 400;
      const pic = await dxSvgPng(svg, W, H, 2.6);
      const k = Math.min(1, 59e5 / (W * 9525));
      const cx = Math.round(W * 9525 * k);
      const cy = Math.round(H * 9525 * k);
      const id = imgs.length + 1;
      imgs.push(pic);
      body += dxPara(dxPicture('rIdImg' + id, id, cx, cy, 'Hình ' + id), {
        jc: 'center',
        keepNext: true,
        sp: [80, 20],
      });
    } else if (tg === 'P' && cl.contains('cap')) {
      body += dxPara(dxTxt(e, { i: true, sz: 20 }), { jc: 'center', sp: [20, 200] });
    } else if (tg === 'P' && cl.contains('small')) {
      body += dxPara(dxTxt(e, { sz: 20, c: '555B60' }), { ind: 700, sp: [20, 40] });
    } else if (tg === 'P' && cl.contains('kl')) {
      body += dxPara(
        dxTxt(e, {
          b: true,
          c: cl.contains('ok') ? '006B2D' : cl.contains('bad') ? 'C00000' : undefined,
        }),
        { ind: 700, sp: [100, 200], keepLines: true },
      );
    } else {
      body += dxPara(dxTxt(e, {}), {});
    }
  }
  flush();

  const sect =
    '<w:sectPr><w:footerReference w:type="default" r:id="rIdFtr"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="851" w:bottom="1134" w:left="1418" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>';

  const files: ZipEntryInput[] = [
    {
      n: '[Content_Types].xml',
      d:
        DX_HDR +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>',
    },
    {
      n: '_rels/.rels',
      d:
        DX_HDR +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>',
    },
    {
      n: 'docProps/core.xml',
      d:
        DX_HDR +
        `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${dxE(title)}</dc:title><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created></cp:coreProperties>`,
    },
    {
      n: 'docProps/app.xml',
      d:
        DX_HDR +
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Tường chắn chữ L - LEDAT</Application></Properties>',
    },
    {
      n: 'word/document.xml',
      d: DX_HDR + `<w:document ${DX_NS}><w:body>${body}${sect}</w:body></w:document>`,
    },
    { n: 'word/styles.xml', d: dxStyles() },
    { n: 'word/settings.xml', d: dxSettings() },
    { n: 'word/footer1.xml', d: dxFooter() },
    {
      n: 'word/_rels/document.xml.rels',
      d:
        DX_HDR +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdSty" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSet" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdFtr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' +
        imgs
          .map(
            (m, i) =>
              `<Relationship Id="rIdImg${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${i + 1}.${m.ext}"/>`,
          )
          .join('') +
        '</Relationships>',
    },
  ];
  imgs.forEach((m, i) =>
    files.push({ n: `word/media/image${i + 1}.${m.ext}`, d: m.d, store: true }),
  );
  return zipBuild(files);
}

export async function calcExportDocx(
  P: EngineProject,
  onProgress?: (msg: string) => void,
): Promise<{ blob: Blob; result: CalcValidResult }> {
  let R = calcRun(P);
  if ('error' in R && R.error) throw new Error(R.error);
  R = await calcEnsureAll(P, (t) => onProgress?.(t));
  if ('error' in R && R.error) throw new Error(R.error);
  if ('unsupported' in R && R.unsupported) throw new Error(R.msg);
  onProgress?.('Đang tạo file…');
  const blob = await calcDocxBlob(P, R);
  return { blob, result: R as CalcValidResult };
}
