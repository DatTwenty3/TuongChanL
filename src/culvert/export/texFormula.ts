/**
 * Chuyển công thức TeX hiển thị trong bảng tính (`<span class="m" data-tex="E_c = 0.0017\,K_1\,w_c^2\,f_c'^{0.33}">`)
 * thành công thức Excel nối với các ô khác (`=0.0017*J12*J13^2*J8^0.33`).
 *
 * Bộ phân tích chỉ hiểu tập con TeX mà các bảng tính dùng (số, ký hiệu có chỉ số dưới / dấu phẩy trên, + − · ×, phân số,
 * căn, lũy thừa, ngoặc, abs, min / max / exp / ln / log / sin / cos / tan / arc*, π). Gặp gì không hiểu thì ném lỗi
 * để nơi gọi giữ nguyên giá trị tĩnh — không bao giờ đoán.
 *
 * An toàn: `evaluate` tính lại công thức bằng chính các số đang hiển thị trong các ô được tham chiếu; nơi gọi chỉ
 * ghi công thức khi kết quả khớp với giá trị hiển thị của ô (xem `excelExport.ts`).
 */

export type Ast =
  | { t: 'num'; v: number }
  | { t: 'sym'; key: string }
  | { t: 'neg'; a: Ast }
  | { t: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Ast; b: Ast }
  | { t: 'fn'; name: FnName; args: Ast[] };

export type FnName =
  | 'SQRT'
  | 'EXP'
  | 'LN'
  | 'LOG10'
  | 'ABS'
  | 'MIN'
  | 'MAX'
  | 'SIN'
  | 'COS'
  | 'TAN'
  | 'ASIN'
  | 'ACOS'
  | 'ATAN'
  | 'COT'
  | 'PI';

const GREEK: Record<string, string> = {
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  varepsilon: 'ε',
  zeta: 'ζ',
  eta: 'η',
  theta: 'θ',
  vartheta: 'θ',
  lambda: 'λ',
  mu: 'μ',
  nu: 'ν',
  xi: 'ξ',
  rho: 'ρ',
  varrho: 'ρ',
  sigma: 'σ',
  tau: 'τ',
  phi: 'φ',
  varphi: 'φ',
  chi: 'χ',
  psi: 'ψ',
  omega: 'ω',
  ell: 'ℓ',
  Delta: 'Δ',
  Sigma: 'Σ',
  Phi: 'Φ',
  Omega: 'Ω',
  Gamma: 'Γ',
  Theta: 'Θ',
  Lambda: 'Λ',
  Psi: 'Ψ',
};

const FUNCS: Record<string, FnName> = {
  exp: 'EXP',
  ln: 'LN',
  log: 'LOG10',
  sin: 'SIN',
  cos: 'COS',
  tan: 'TAN',
  arcsin: 'ASIN',
  arccos: 'ACOS',
  arctan: 'ATAN',
  cot: 'COT',
  min: 'MIN',
  max: 'MAX',
};

/** Khóa ký hiệu chuẩn hóa để so ký hiệu trong TeX với cột "ký hiệu" của bảng tính (`f'c`, `f_c'` → `fc`; `\beta_1` ↔ `β1`). */
export function normSym(s: string): string {
  return s
    .replace(/[\s'’′´`_{}\\]/g, '')
    .replace(/[ɣ]/g, 'γ')
    .replace(/ϕ|φ/g, 'φ');
}

type Tok =
  | { k: 'num'; v: number }
  | { k: 'id'; key: string }
  | { k: 'op'; v: string }
  | { k: 'cmd'; v: string };

class TexError extends Error {}

function fail(msg: string): never {
  throw new TexError(msg);
}

function matchBrace(s: string, i: number): number {
  // s[i] === '{' → chỉ số của '}' tương ứng
  let d = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') d++;
    else if (s[j] === '}') {
      d--;
      if (d === 0) return j;
    }
  }
  return fail('ngoặc nhọn không cân');
}

/** Chuẩn hóa chuỗi nhập của chỉ số dưới: bỏ `\`, `{}` và đổi lệnh Hy Lạp. */
function subKey(raw: string): string {
  return normSym(
    raw.replace(/\\([A-Za-z]+)/g, (_m, c: string) => GREEK[c] ?? c).replace(/\\mathrm|\\text|\\mathit/g, ''),
  );
}

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const n = src.length;
  const readGroupOrChar = (): string => {
    // sau `_` hoặc `^`: một ký tự / lệnh hoặc nhóm {…}
    while (src[i] === ' ') i++;
    if (src[i] === '{') {
      const j = matchBrace(src, i);
      const g = src.slice(i + 1, j);
      i = j + 1;
      return g;
    }
    if (src[i] === '\\') {
      let j = i + 1;
      while (j < n && /[A-Za-z]/.test(src[j])) j++;
      const g = src.slice(i, j);
      i = j;
      return g;
    }
    const g = src[i] ?? '';
    i += 1;
    return g;
  };
  while (i < n) {
    const ch = src[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '~') {
      i++;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      let j = i;
      while (j < n && /[0-9]/.test(src[j])) j++;
      if (src[j] === '.' && /[0-9]/.test(src[j + 1] ?? '')) {
        j++;
        while (j < n && /[0-9]/.test(src[j])) j++;
      }
      out.push({ k: 'num', v: parseFloat(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (ch === '\\') {
      let j = i + 1;
      if (/[A-Za-z]/.test(src[j] ?? '')) {
        while (j < n && /[A-Za-z]/.test(src[j])) j++;
      } else {
        j += 1; // \, \; \! \ \{ …
      }
      const name = src.slice(i + 1, j);
      i = j;
      if (GREEK[name]) {
        // ký hiệu Hy Lạp + chỉ số / dấu phẩy
        let key = GREEK[name];
        for (;;) {
          if (src[i] === "'" || src.startsWith('^{\\prime}', i) || src.startsWith('^\\prime', i)) {
            i += src[i] === "'" ? 1 : src.startsWith('^{\\prime}', i) ? 9 : 7;
            continue;
          }
          if (src[i] === '_') {
            i += 1;
            key += subKey(readGroupOrChar());
            continue;
          }
          break;
        }
        out.push({ k: 'id', key: normSym(key) });
        continue;
      }
      if (name === ',' || name === ';' || name === '!' || name === ' ' || name === 'quad' || name === 'qquad' || name === ':') {
        out.push({ k: 'op', v: name === ';' ? 'sp' : 'sp' });
        continue;
      }
      if (name === 'cdot' || name === 'times' || name === 'ast') {
        out.push({ k: 'op', v: '*' });
        continue;
      }
      if (name === 'div') {
        out.push({ k: 'op', v: '/' });
        continue;
      }
      if (name === 'left' || name === 'right') {
        // \left( \right) \left| \right|  \left[ … : giữ nguyên ký tự phân cách
        continue;
      }
      if (name === 'mathrm' || name === 'mathit' || name === 'operatorname' || name === 'mathbf') {
        while (src[i] === ' ') i++;
        if (src[i] !== '{') fail('thiếu nhóm sau \\' + name);
        const e = matchBrace(src, i);
        const body = src.slice(i + 1, e);
        i = e + 1;
        if (!/^[A-Za-z]+$/.test(body)) fail('\\' + name + ' không phải ký hiệu');
        let key = body;
        for (;;) {
          if (src[i] === "'") {
            i += 1;
            continue;
          }
          if (src[i] === '_') {
            i += 1;
            key += subKey(readGroupOrChar());
            continue;
          }
          break;
        }
        out.push({ k: 'id', key: normSym(key) });
        continue;
      }
      if (name === 'pi') {
        out.push({ k: 'cmd', v: 'pi' });
        continue;
      }
      if (name === 'circ') {
        out.push({ k: 'cmd', v: 'circ' });
        continue;
      }
      if (
        ['dfrac', 'frac', 'tfrac', 'sqrt', 'exp', 'ln', 'log', 'sin', 'cos', 'tan', 'arcsin', 'arccos', 'arctan', 'cot', 'min', 'max'].includes(
          name,
        )
      ) {
        out.push({ k: 'cmd', v: name });
        continue;
      }
      return fail('lệnh TeX chưa hỗ trợ: \\' + name);
    }
    if (/[A-Za-z]/.test(ch)) {
      let j = i;
      while (j < n && /[A-Za-z]/.test(src[j])) j++;
      let base = src.slice(i, j);
      i = j;
      // một dãy chữ cái có chỉ số dưới / dấu phẩy: coi cả dãy là một ký hiệu nếu dài hơn 1 ký tự (GSI, DE, LLDF…)
      let key = base;
      for (;;) {
        if (src[i] === "'") {
          i += 1;
          continue;
        }
        if (src.startsWith('^{\\prime}', i)) {
          i += 9;
          continue;
        }
        if (src[i] === '_') {
          i += 1;
          key += subKey(readGroupOrChar());
          continue;
        }
        break;
      }
      out.push({ k: 'id', key: normSym(key) });
      continue;
    }
    if ('+-*/^()[]{}|=,;<>'.includes(ch)) {
      out.push({ k: 'op', v: ch });
      i++;
      continue;
    }
    if (ch === '·' || ch === '×') {
      out.push({ k: 'op', v: '*' });
      i++;
      continue;
    }
    if (ch === '−' || ch === '–') {
      out.push({ k: 'op', v: '-' });
      i++;
      continue;
    }
    if (/[α-ωΑ-Ωɣ]/.test(ch)) {
      let key = ch;
      i++;
      for (;;) {
        if (src[i] === "'") {
          i++;
          continue;
        }
        if (src[i] === '_') {
          i++;
          key += subKey(readGroupOrChar());
          continue;
        }
        break;
      }
      out.push({ k: 'id', key: normSym(key) });
      continue;
    }
    return fail('ký tự chưa hỗ trợ: ' + ch);
  }
  return out;
}

class Parser {
  private p = 0;
  constructor(
    private readonly toks: Tok[],
    private readonly srcOf: (inner: string) => Tok[],
  ) {}

  done(): boolean {
    return this.p >= this.toks.length;
  }

  private peek(): Tok | undefined {
    while (this.toks[this.p] && this.toks[this.p].k === 'op' && (this.toks[this.p] as { v: string }).v === 'sp') this.p++;
    return this.toks[this.p];
  }

  private isOp(v: string): boolean {
    const t = this.peek();
    return !!t && t.k === 'op' && t.v === v;
  }

  private take(): Tok {
    const t = this.peek();
    if (!t) return fail('hết biểu thức');
    this.p++;
    return t;
  }

  expr(): Ast {
    let a = this.term();
    for (;;) {
      if (this.isOp('+')) {
        this.take();
        a = { t: 'bin', op: '+', a, b: this.term() };
      } else if (this.isOp('-')) {
        this.take();
        a = { t: 'bin', op: '-', a, b: this.term() };
      } else return a;
    }
  }

  private startsFactor(): boolean {
    const t = this.peek();
    if (!t) return false;
    if (t.k === 'num' || t.k === 'id' || t.k === 'cmd') return true;
    return t.k === 'op' && (t.v === '(' || t.v === '[' || t.v === '{' || t.v === '|');
  }

  private term(): Ast {
    let a = this.unary();
    for (;;) {
      if (this.isOp('*')) {
        this.take();
        a = { t: 'bin', op: '*', a, b: this.unary() };
      } else if (this.isOp('/')) {
        this.take();
        a = { t: 'bin', op: '/', a, b: this.unary() };
      } else if (this.startsFactor()) {
        a = { t: 'bin', op: '*', a, b: this.unary() }; // nhân ngầm
      } else return a;
    }
  }

  private unary(): Ast {
    if (this.isOp('-')) {
      this.take();
      return { t: 'neg', a: this.unary() };
    }
    if (this.isOp('+')) {
      this.take();
      return this.unary();
    }
    return this.power();
  }

  private power(): Ast {
    const base = this.primary();
    if (this.isOp('^')) {
      this.take();
      if (this.peek()?.k === 'cmd' && (this.peek() as { v: string }).v === 'circ') {
        fail('độ (°) chưa hỗ trợ');
      }
      let e: Ast;
      if (this.isOp('{')) {
        this.take();
        e = this.expr();
        this.expectOp('}');
      } else e = this.power(); // ^2, ^n …
      return { t: 'bin', op: '^', a: base, b: e };
    }
    return base;
  }

  private expectOp(v: string): void {
    const t = this.take();
    if (t.k !== 'op' || t.v !== v) fail('thiếu ' + v);
  }

  /** Nhóm {…} dùng làm đối số của \frac, \sqrt. */
  private group(): Ast {
    this.expectOp('{');
    const e = this.expr();
    this.expectOp('}');
    return e;
  }

  private primary(): Ast {
    const t = this.take();
    if (t.k === 'num') {
      // số + ^\circ : chưa hỗ trợ (đã chặn ở power)
      return { t: 'num', v: t.v };
    }
    if (t.k === 'id') return { t: 'sym', key: t.key };
    if (t.k === 'cmd') {
      switch (t.v) {
        case 'pi':
          return { t: 'fn', name: 'PI', args: [] };
        case 'dfrac':
        case 'frac':
        case 'tfrac': {
          const a = this.group();
          const b = this.group();
          return { t: 'bin', op: '/', a, b };
        }
        case 'sqrt': {
          if (this.isOp('[')) {
            this.take();
            const n = this.expr();
            this.expectOp(']');
            return { t: 'bin', op: '^', a: this.group(), b: { t: 'bin', op: '/', a: { t: 'num', v: 1 }, b: n } };
          }
          return { t: 'fn', name: 'SQRT', args: [this.group()] };
        }
        case 'min':
        case 'max': {
          const name = FUNCS[t.v];
          const open = this.take();
          if (open.k !== 'op' || (open.v !== '(' && open.v !== '[')) fail('thiếu ngoặc sau \\' + t.v);
          const args: Ast[] = [this.expr()];
          while (this.isOp(';') || this.isOp(',')) {
            this.take();
            args.push(this.expr());
          }
          const close = this.take();
          if (close.k !== 'op' || (close.v !== ')' && close.v !== ']')) fail('thiếu ngoặc đóng');
          return { t: 'fn', name, args };
        }
        default: {
          const name = FUNCS[t.v];
          if (!name) return fail('hàm chưa hỗ trợ: ' + t.v);
          // đối số: (…) hoặc một thừa số
          let arg: Ast;
          if (this.isOp('(') || this.isOp('[')) {
            this.take();
            arg = this.expr();
            this.take(); // ) hoặc ]
          } else arg = this.power();
          return { t: 'fn', name, args: [arg] };
        }
      }
    }
    if (t.k === 'op') {
      if (t.v === '(' || t.v === '[') {
        const e = this.expr();
        const c = this.take();
        if (c.k !== 'op' || (c.v !== ')' && c.v !== ']')) fail('thiếu ngoặc đóng');
        return e;
      }
      if (t.v === '{') {
        const e = this.expr();
        this.expectOp('}');
        return e;
      }
      if (t.v === '|') {
        const e = this.expr();
        this.expectOp('|');
        return { t: 'fn', name: 'ABS', args: [e] };
      }
    }
    return fail('không hiểu: ' + JSON.stringify(t));
  }
}

/** Cắt phần chú thích nguồn `\quad (\text{4.2.4})` ở cuối và tách phần định nghĩa khỏi các điều kiện sau dấu `;`. */
function splitEquation(tex: string): { def: string; extra: string[] } {
  let s = tex
    .replace(/\\q?quad\s*\(\\text\{[^}]*\}\)\s*$/g, '')
    .replace(/\\ *\(\\text\{[^}]*\}\)\s*$/g, '')
    .replace(/\\q?quad/g, ' ')
    .trim();
  // tách theo dấu `;` ở mức ngoài cùng
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === ';' && depth === 0 && s[i - 1] !== '\\') {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  s = parts[0]
    .trim()
    .replace(/\\ *$/g, '')
    .trim();
  return { def: s, extra: parts.slice(1).map((p) => p.replace(/\\ /g, ' ').trim()) };
}

export interface ParsedEquation {
  lhs: string; // khóa ký hiệu vế trái (đã chuẩn hóa)
  ast: Ast;
  /** [lo, hi] nếu có ràng buộc dạng `a ≤ x ≤ b` (kẹp kết quả) */
  clamp?: [number, number];
}

function parseExpr(src: string): Ast {
  const toks = tokenize(src);
  if (!toks.length) fail('rỗng');
  const P = new Parser(toks, tokenize);
  const a = P.expr();
  if (!P.done()) {
    // còn token thừa (vd. "\ ≤ …"): coi như không hiểu
    return fail('token thừa');
  }
  return a;
}

/** Phân tích `SYM = biểu_thức [; a ≤ SYM ≤ b]`. Ném lỗi nếu có thành phần chưa hỗ trợ. */
export function parseEquation(tex: string): ParsedEquation {
  if (/\\(le|leq|ge|geq|approx|neq|text|circ|sum|int|prod|lim)\b/.test(tex.replace(/\\q?quad\s*\(\\text\{[^}]*\}\)/g, ''))) {
    // các ràng buộc trong dấu `;` được xử lý bên dưới; phần định nghĩa chính không được chứa chúng
    const { def } = splitEquation(tex);
    if (/\\(le|leq|ge|geq|approx|neq|text|circ|sum|int|prod|lim)\b/.test(def)) fail('toán tử chưa hỗ trợ');
  }
  const { def, extra } = splitEquation(tex);
  // tách vế trái ở dấu = đầu tiên (mức ngoài cùng)
  let depth = 0;
  let eq = -1;
  for (let i = 0; i < def.length; i++) {
    const ch = def[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === '=' && depth === 0) {
      eq = i;
      break;
    }
  }
  if (eq < 0) fail('không có dấu =');
  const lhsToks = tokenize(def.slice(0, eq));
  if (lhsToks.length !== 1 || lhsToks[0].k !== 'id') fail('vế trái không phải một ký hiệu');
  let rhs = def.slice(eq + 1);
  // chuỗi a = b = c: giữ vế đầu tiên
  depth = 0;
  for (let i = 0; i < rhs.length; i++) {
    const ch = rhs[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === '=' && depth === 0) {
      rhs = rhs.slice(0, i);
      break;
    }
  }
  const ast = parseExpr(rhs);
  const lhs = (lhsToks[0] as { key: string }).key;

  let clamp: [number, number] | undefined;
  for (const e of extra) {
    // `0.65 \le \beta_1 \le 0.85`
    const m = /^([0-9.]+)\s*\\le(?:q)?\s*(.+?)\s*\\le(?:q)?\s*([0-9.]+)$/.exec(e);
    if (m) {
      const k = tokenize(m[2]);
      if (k.length === 1 && k[0].k === 'id' && k[0].key === lhs) clamp = [parseFloat(m[1]), parseFloat(m[3])];
    }
  }
  return { lhs, ast, clamp };
}

/** Các khóa ký hiệu được tham chiếu trong biểu thức. */
export function symbolsOf(a: Ast, out = new Set<string>()): Set<string> {
  switch (a.t) {
    case 'sym':
      out.add(a.key);
      break;
    case 'neg':
      symbolsOf(a.a, out);
      break;
    case 'bin':
      symbolsOf(a.a, out);
      symbolsOf(a.b, out);
      break;
    case 'fn':
      a.args.forEach((x) => symbolsOf(x, out));
      break;
    default:
  }
  return out;
}

export interface EvalOpts {
  /** Đối số hàm lượng giác tính bằng độ (kết quả hàm ngược cũng trả về độ). */
  deg?: boolean;
}

export function evaluate(a: Ast, val: (key: string) => number, o: EvalOpts = {}): number {
  switch (a.t) {
    case 'num':
      return a.v;
    case 'sym':
      return val(a.key);
    case 'neg':
      return -evaluate(a.a, val, o);
    case 'bin': {
      const x = evaluate(a.a, val, o);
      const y = evaluate(a.b, val, o);
      return a.op === '+' ? x + y : a.op === '-' ? x - y : a.op === '*' ? x * y : a.op === '/' ? x / y : Math.pow(x, y);
    }
    case 'fn': {
      const v = a.args.map((x) => evaluate(x, val, o));
      const rad = (x: number) => (o.deg ? (x * Math.PI) / 180 : x);
      const out = (x: number) => (o.deg ? (x * 180) / Math.PI : x);
      switch (a.name) {
        case 'SQRT':
          return Math.sqrt(v[0]);
        case 'EXP':
          return Math.exp(v[0]);
        case 'LN':
          return Math.log(v[0]);
        case 'LOG10':
          return Math.log10(v[0]);
        case 'ABS':
          return Math.abs(v[0]);
        case 'MIN':
          return Math.min(...v);
        case 'MAX':
          return Math.max(...v);
        case 'SIN':
          return Math.sin(rad(v[0]));
        case 'COS':
          return Math.cos(rad(v[0]));
        case 'TAN':
          return Math.tan(rad(v[0]));
        case 'COT':
          return 1 / Math.tan(rad(v[0]));
        case 'ASIN':
          return out(Math.asin(v[0]));
        case 'ACOS':
          return out(Math.acos(v[0]));
        case 'ATAN':
          return out(Math.atan(v[0]));
        case 'PI':
          return Math.PI;
        default:
          return NaN;
      }
    }
    default:
      return NaN;
  }
}

const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 4 };

function numStr(v: number): string {
  // không dùng ký hiệu khoa học (Excel nhận 1E-05 nhưng giữ dạng đọc được khi có thể)
  return Number.isInteger(v) ? String(v) : String(+v.toPrecision(15));
}

/** Biểu thức Excel (không có dấu `=` đầu). `ref(key)` trả về địa chỉ ô, vd. `J12`. */
export function toExcel(a: Ast, ref: (key: string) => string, o: EvalOpts = {}): string {
  const go = (n: Ast, parentPrec = 0, right = false): string => {
    switch (n.t) {
      case 'num':
        return numStr(n.v);
      case 'sym':
        return ref(n.key);
      case 'neg': {
        // Excel: `-` một ngôi ưu tiên hơn `^` (-2^2 = 4) nên -(a^b) phải có ngoặc
        const inner = n.a.t === 'bin' && n.a.op === '^' ? `(${go(n.a, 0)})` : go(n.a, 3);
        const s = '-' + inner;
        return parentPrec > 3 ? `(${s})` : s;
      }
      case 'bin': {
        const p = PREC[n.op];
        let s: string;
        if (n.op === '^') s = `${go(n.a, 5)}^${go(n.b, 5)}`;
        else s = `${go(n.a, p)}${n.op}${go(n.b, p, true)}`;
        const need = p < parentPrec || (right && p === parentPrec);
        return need ? `(${s})` : s;
      }
      case 'fn': {
        const args = n.args.map((x) => go(x, 0));
        const trig = ['SIN', 'COS', 'TAN'];
        const inv = ['ASIN', 'ACOS', 'ATAN'];
        if (n.name === 'PI') return 'PI()';
        if (n.name === 'COT') return o.deg ? `1/TAN(RADIANS(${args[0]}))` : `1/TAN(${args[0]})`;
        if (o.deg && trig.includes(n.name)) return `${n.name}(RADIANS(${args[0]}))`;
        if (o.deg && inv.includes(n.name)) return `DEGREES(${n.name}(${args[0]}))`;
        return `${n.name}(${args.join(',')})`;
      }
      default:
        return '0';
    }
  };
  return go(a, 0);
}

/**
 * Bộ tính độc lập cho CHUỖI công thức Excel do `toExcel` sinh ra, theo đúng quy ước của Excel:
 * `-` một ngôi ưu tiên cao hơn `^`, `^` kết hợp từ TRÁI sang phải. Dùng để chắc chắn rằng chuỗi ghi vào ô
 * (chứ không chỉ cây cú pháp) cho đúng giá trị — nếu lệch thì không xuất công thức.
 */
export function evalExcelString(f: string, ref: (addr: string) => number): number {
  let i = 0;
  const peek = () => {
    while (f[i] === ' ') i++;
    return f[i];
  };
  const err = (m: string): never => {
    throw new Error('công thức Excel không hợp lệ: ' + m + ' @' + i + ' ' + f);
  };
  const expr = (): number => {
    let a = term();
    for (;;) {
      const c = peek();
      if (c === '+') {
        i++;
        a += term();
      } else if (c === '-') {
        i++;
        a -= term();
      } else return a;
    }
  };
  const term = (): number => {
    let a = pow();
    for (;;) {
      const c = peek();
      if (c === '*') {
        i++;
        a *= pow();
      } else if (c === '/') {
        i++;
        a /= pow();
      } else return a;
    }
  };
  const pow = (): number => {
    let a = unary();
    while (peek() === '^') {
      i++;
      a = Math.pow(a, unary()); // kết hợp trái
    }
    return a;
  };
  const unary = (): number => {
    const c = peek();
    if (c === '-') {
      i++;
      return -unary();
    }
    if (c === '+') {
      i++;
      return unary();
    }
    return atom();
  };
  const atom = (): number => {
    const c = peek();
    if (c === '(') {
      i++;
      const v = expr();
      if (peek() !== ')') err('thiếu )');
      i++;
      return v;
    }
    const num = /^[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?/.exec(f.slice(i));
    if (num && c !== undefined && /[0-9.]/.test(c)) {
      i += num[0].length;
      return parseFloat(num[0]);
    }
    const id = /^[A-Za-z][A-Za-z0-9]*/.exec(f.slice(i));
    if (!id) return err('không hiểu');
    i += id[0].length;
    if (peek() === '(') {
      i++;
      const args: number[] = [];
      if (peek() !== ')') {
        args.push(expr());
        while (peek() === ',') {
          i++;
          args.push(expr());
        }
      }
      if (peek() !== ')') err('thiếu )');
      i++;
      const fn = id[0].toUpperCase();
      const m: Record<string, (x: number[]) => number> = {
        SQRT: (x) => Math.sqrt(x[0]),
        EXP: (x) => Math.exp(x[0]),
        LN: (x) => Math.log(x[0]),
        LOG10: (x) => Math.log10(x[0]),
        ABS: (x) => Math.abs(x[0]),
        MIN: (x) => Math.min(...x),
        MAX: (x) => Math.max(...x),
        SIN: (x) => Math.sin(x[0]),
        COS: (x) => Math.cos(x[0]),
        TAN: (x) => Math.tan(x[0]),
        ASIN: (x) => Math.asin(x[0]),
        ACOS: (x) => Math.acos(x[0]),
        ATAN: (x) => Math.atan(x[0]),
        RADIANS: (x) => (x[0] * Math.PI) / 180,
        DEGREES: (x) => (x[0] * 180) / Math.PI,
        PI: () => Math.PI,
      };
      const g = m[fn];
      return g ? g(args) : err('hàm ' + fn);
    }
    return ref(id[0]);
  };
  const v = expr();
  if (peek() !== undefined) err('còn ký tự thừa');
  return v;
}
