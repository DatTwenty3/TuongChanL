export interface TexToken {
  k: 'cmd' | '{' | '}' | '^' | '_' | 'ch';
  v?: string;
}

export const TEX_SYM: Record<string, string> = {
  phi: 'φ',
  varphi: 'φ',
  gamma: 'γ',
  beta: 'β',
  theta: 'θ',
  delta: 'δ',
  tau: 'τ',
  sigma: 'σ',
  Delta: 'Δ',
  varepsilon: 'ε',
  epsilon: 'ε',
  mu: 'μ',
  pi: 'π',
  alpha: 'α',
  lambda: 'λ',
  eta: 'η',
  rho: 'ρ',
  omega: 'ω',
  Omega: 'Ω',
  Sigma: 'Σ',
  Phi: 'Φ',
  Gamma: 'Γ',
  Theta: 'Θ',
  Lambda: 'Λ',
  Pi: 'Π',
  Psi: 'Ψ',
  Xi: 'Ξ',
  psi: 'ψ',
  kappa: 'κ',
  xi: 'ξ',
  nu: 'ν',
  chi: 'χ',
  zeta: 'ζ',
  le: '≤',
  leq: '≤',
  ge: '≥',
  geq: '≥',
  ne: '≠',
  neq: '≠',
  approx: '≈',
  cdot: '·',
  times: '×',
  pm: '±',
  mp: '∓',
  to: '→',
  rightarrow: '→',
  in: '∈',
  sum: 'Σ',
  infty: '∞',
  ldots: '…',
  cdots: '⋯',
  prime: '′',
  degree: '°',
  circ: '°',
  ll: '≪',
  gg: '≫',
  equiv: '≡',
  propto: '∝',
  angle: '∠',
  perp: '⊥',
  parallel: '∥',
  Rightarrow: '⇒',
  leftrightarrow: '↔',
  partial: '∂',
  nabla: '∇',
  int: '∫',
  '{': '{',
  '}': '}',
  '%': '%',
  '&': '&amp;',
  _: '_',
  '#': '#',
  $: '$',
  ' ': ' ',
};

export const TEX_REL = new Set<string>([
  'le',
  'leq',
  'ge',
  'geq',
  'ne',
  'neq',
  'approx',
  'equiv',
  'to',
  'rightarrow',
  'Rightarrow',
  'leftrightarrow',
  'in',
  'll',
  'gg',
  'propto',
]);

export const TEX_FN = new Set<string>([
  'sin',
  'cos',
  'tan',
  'cot',
  'min',
  'max',
  'log',
  'ln',
  'lim',
  'exp',
  'arctan',
  'arcsin',
  'arccos',
  'sup',
  'inf',
]);

export const TEX_SP: Record<string, string> = {
  quad: '<span class="tq"></span>',
  qquad: '<span class="tq"></span><span class="tq"></span>',
  ';': '<span class="tm"></span>',
  ':': '<span class="tm"></span>',
  ',': '<span class="tn"></span>',
  '!': '',
  ' ': '<span class="tn"></span>',
};

export const texEsc = (s: unknown): string =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function texTokens(s: string): TexToken[] {
  const t: TexToken[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') {
      let j = i + 1;
      if (j < s.length && /[A-Za-z]/.test(s[j])) {
        while (j < s.length && /[A-Za-z]/.test(s[j])) j++;
        t.push({ k: 'cmd', v: s.slice(i + 1, j) });
        i = j;
      } else if (j < s.length) {
        t.push({ k: 'cmd', v: s[j] });
        i = j + 1;
      } else {
        i = j;
      }
    } else if (c === '{' || c === '}' || c === '^' || c === '_') {
      t.push({ k: c });
      i++;
    } else {
      t.push({ k: 'ch', v: c });
      i++;
    }
  }
  return t;
}

export function texToHtml(src: string): string {
  const T = texTokens(String(src));
  let pos = 0;

  function group(): string {
    const t = T[pos];
    if (!t) return '';
    if (t.k === '{') {
      pos++;
      const h = seq(true);
      if (T[pos] && T[pos].k === '}') pos++;
      return h;
    }
    return atom();
  }

  function rawText(): string {
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
      } else if (t.k === 'cmd') {
        const v = t.v ?? '';
        s +=
          TEX_SYM[v] !== undefined
            ? TEX_SYM[v]
            : v === ',' || v === ';' || v === ' '
              ? ' '
              : '';
      } else if (t.k === 'ch') {
        s += t.v ?? '';
      } else {
        s += t.k;
      }
    }
    return s;
  }

  function atom(): string {
    const t = T[pos++];
    if (!t) return '';
    if (t.k === 'ch') {
      const c = t.v ?? '';
      if (/[A-Za-z]/.test(c)) return `<i>${c}</i>`;
      if (c === "'") return '′';
      if (c === ' ') return '';
      if (c === '=' || c === '<' || c === '>') return `<span class="trl">${texEsc(c)}</span>`;
      if (c === '&') return texEsc(c);
      if (c === '+' || c === '-') {
        let j = pos - 2;
        while (j >= 0 && T[j].k === 'ch' && T[j].v === ' ') j--;
        const pv = j >= 0 ? T[j] : undefined;
        const bin =
          !!pv &&
          (pv.k === '}' ||
            (pv.k === 'ch' && /[A-Za-z0-9)\]'.]/.test(pv.v ?? '')) ||
            (pv.k === 'cmd' &&
              pv.v !== undefined &&
              TEX_SYM[pv.v] !== undefined &&
              !TEX_REL.has(pv.v)));
        const sy = c === '-' ? '−' : '+';
        return bin ? `<span class="tbn">${sy}</span>` : sy;
      }
      return c;
    }
    if (t.k === '{') {
      pos--;
      return group();
    }
    if (t.k === 'cmd') {
      const v = t.v ?? '';
      if (v === 'dfrac' || v === 'frac' || v === 'tfrac') {
        const a = group();
        const b = group();
        return `<span class="tf"><span class="tu">${a}</span><span class="td">${b}</span></span>`;
      }
      if (v === 'sqrt') {
        const a = group();
        return `<span class="ts"><span class="tr">√</span><span class="tc">${a}</span></span>`;
      }
      if (v === 'text' || v === 'mathrm' || v === 'textrm' || v === 'mbox') {
        return `<span class="tt">${texEsc(rawText())}</span>`;
      }
      if (v === 'mathbf' || v === 'textbf' || v === 'boldsymbol') {
        return `<b>${group()}</b>`;
      }
      if (v === 'overline' || v === 'bar') {
        return `<span class="to">${group()}</span>`;
      }
      if (v === 'left') {
        const dl = (d?: TexToken): string => {
          if (!d) return '';
          if (d.k === 'ch') return d.v === '.' ? '' : (d.v ?? '');
          if (d.k === 'cmd' && d.v !== undefined) {
            return TEX_SYM[d.v] !== undefined ? TEX_SYM[d.v] : '';
          }
          return '';
        };
        const op = dl(T[pos++]);
        const inner = seq(false, true);
        let cl = '';
        if (T[pos] && T[pos].k === 'cmd' && T[pos].v === 'right') {
          pos++;
          cl = dl(T[pos++]);
        }
        const big = /class="(tf|ts)"/.test(inner);
        return big
          ? `<span class="tl">${op}</span>${inner}<span class="tl">${cl}</span>`
          : op + inner + cl;
      }
      if (v === 'right') {
        const d = T[pos++];
        if (!d) return '';
        if (d.k === 'ch') return d.v === '.' ? '' : (d.v ?? '');
        if (d.k === 'cmd' && d.v !== undefined) {
          return TEX_SYM[d.v] !== undefined ? TEX_SYM[d.v] : '';
        }
        return '';
      }
      if (v === 'big' || v === 'Big' || v === 'bigg' || v === 'Bigg') {
        const d = T[pos++];
        return d && d.k === 'ch' ? (d.v ?? '') : '';
      }
      if (v === '\\') return '<br>';
      if (TEX_SP[v] !== undefined) return TEX_SP[v];
      if (TEX_FN.has(v)) return `<span class="tt">${v}</span>`;
      if (TEX_SYM[v] !== undefined) {
        const r = TEX_SYM[v];
        if (TEX_REL.has(v)) return `<span class="trl">${r}</span>`;
        if (v === 'cdot' || v === 'times' || v === 'pm' || v === 'mp') {
          return `<span class="tbn">${r}</span>`;
        }
        return /[A-Za-zΑ-ω]/.test(r) && !/[≤≥≠≈·×±→∈ΣΔΓΘΛΠΨΞΦΩ…⋯′°∞]/.test(r)
          ? `<i>${r}</i>`
          : r;
      }
      return '';
    }
    return '';
  }

  function seq(inBrace: boolean, stopRight = false): string {
    let h = '';
    while (pos < T.length) {
      const t = T[pos];
      if (t.k === '}') {
        if (inBrace) break;
        pos++;
        continue;
      }
      if (stopRight && t.k === 'cmd' && t.v === 'right') break;
      if (t.k === '^' || t.k === '_') {
        h += scripts('');
        continue;
      }
      let a = atom();
      if (T[pos] && (T[pos].k === '^' || T[pos].k === '_')) a = scripts(a);
      h += a;
    }
    return h;
  }

  function scripts(base: string): string {
    let sub = '';
    let sup = '';
    while (T[pos] && (T[pos].k === '^' || T[pos].k === '_')) {
      const k = T[pos++].k;
      const g = group();
      if (k === '^') sup = g;
      else sub = g;
    }
    if (sub && sup) {
      return `${base}<span class="tss"><span>${sup}</span><span>${sub}</span></span>`;
    }
    if (sup) return `${base}<sup>${sup}</sup>`;
    if (sub) return `${base}<sub>${sub}</sub>`;
    return base;
  }

  return seq(false);
}
