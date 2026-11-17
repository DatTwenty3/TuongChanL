export function fmt(x: number | null | undefined, d = 3): string {
  if (x === undefined || x === null || Number.isNaN(x)) return '–';
  return Number(x).toFixed(d).replace('.', ',');
}

export function fmtI(x: number): string {
  return Math.round(x).toLocaleString('vi-VN');
}

export function fmtExp(x: number, d = 3): string {
  return x.toExponential(d).replace('.', ',');
}
