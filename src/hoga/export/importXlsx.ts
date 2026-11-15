/**
 * Đọc tệp Excel nhập liệu có cùng bố cục với các tệp "HO GA v4" của VHGpro 4:
 * sheet chi tiết ga (GaThamLienKhoi, …), CF.Ga, CF.Cong, CF.Data.
 * Phần phân tích là hàm thuần (nhận bộ đọc ô) để kiểm thử không cần Excel.
 */
import type { GaConfig, GaKind, GaRow, HoGaProject } from '../engine/types';
import { GA_KINDS, GA_KIND_ORDER } from '../engine/types';
import { defaultConfig, defaultProject } from '../engine/defaults';
import type { PipeCatalog } from '../engine/parse';

export type CellGetter = (addr: string) => unknown;

const COLS = (() => {
  const out: string[] = [];
  const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const c of L) out.push(c);
  for (const a of L) for (const b of L) out.push(a + b);
  return out;
})();
const colIdx = (c: string) => COLS.indexOf(c);
const colAt = (i: number) => COLS[i];

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());
const num = (v: unknown, d = 0): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : d;
  const n = Number(str(v).replace(',', '.'));
  return Number.isFinite(n) && str(v) !== '' ? n : d;
};
const yes = (v: unknown): boolean => /^(c[oó]|true|1)$/i.test(str(v));

/* ------------------------------------------------------------------ bảng ga */

/** Cột của sheet chi tiết ga (loại có cổ). */
const COLS_NECK = { name: 'B', L: 'C', B: 'D', H: 'E', tb: 'F', bLow: 'G', bUp: 'H', tw: 'I', wOut: 'J', wIn: 'K', tr: 'L', rUp: 'M', rLow: 'N', pipes: ['O', 'Q', 'S', 'U'], nh: 'W', nt: 'X', nOut: 'Y', nIn: 'Z', level: 'AA' };
/** Cột của sheet ga không cổ. */
const COLS_NONECK = { name: 'B', L: 'C', B: 'D', H: 'E', tb: 'F', bLow: 'G', bUp: 'H', tw: 'I', wOut: 'J', wIn: 'K', tr: 'L', lowD: 'M', upD: 'N', dens: 'O', pipes: ['P', 'R', 'T', 'V'], level: 'X' };

export function parseGaRows(kind: GaKind, get: CellGetter, firstRow = 4, maxRow = 400): GaRow[] {
  const rows: GaRow[] = [];
  const noNeck = !GA_KINDS[kind].hasNeck;
  for (let r = firstRow; r < maxRow; r++) {
    const name = str(get(`B${r}`));
    if (!name) {
      // cho phép một dòng trống rồi dừng
      if (!str(get(`B${r + 1}`))) break;
      continue;
    }
    const at = (c: string) => get(`${c}${r}`);
    const pipe = (c: string) => ({ spec: str(at(c)), depth: num(at(colAt(colIdx(c) + 1))) });
    if (noNeck) {
      const c = COLS_NONECK;
      const dens = num(at(c.dens));
      const lowD = num(at(c.lowD));
      const upD = num(at(c.upD));
      rows.push({
        name,
        count: 1,
        L: num(at(c.L)),
        B: num(at(c.B)),
        H: num(at(c.H)),
        bottom: { t: num(at(c.tb)), low: str(at(c.bLow)), up: str(at(c.bUp)) },
        wall: { t: num(at(c.tw)), out: str(at(c.wOut)), in: str(at(c.wIn)) },
        roof: { t: num(at(c.tr)), low: lowD ? `D${lowD}A${dens}` : '', up: upD ? `D${upD}A${dens}` : '' },
        pipes: [pipe(c.pipes[0]), pipe(c.pipes[1]), pipe(c.pipes[2]), pipe(c.pipes[3])],
        neck: { h: 0, t: 0, out: '', in: '' },
        level: typeof at(c.level) === 'number' ? (at(c.level) as number) : null,
      });
    } else {
      const c = COLS_NECK;
      rows.push({
        name,
        count: 1,
        L: num(at(c.L)),
        B: num(at(c.B)),
        H: num(at(c.H)),
        bottom: { t: num(at(c.tb)), low: str(at(c.bLow)), up: str(at(c.bUp)) },
        wall: { t: num(at(c.tw)), out: str(at(c.wOut)), in: str(at(c.wIn)) },
        roof: { t: num(at(c.tr)), up: str(at(c.rUp)), low: str(at(c.rLow)) },
        pipes: [pipe(c.pipes[0]), pipe(c.pipes[1]), pipe(c.pipes[2]), pipe(c.pipes[3])],
        neck: { h: num(at(c.nh)), t: num(at(c.nt)), out: str(at(c.nOut)), in: str(at(c.nIn)) },
        level: typeof at(c.level) === 'number' ? (at(c.level) as number) : null,
      });
    }
  }
  return rows;
}

/* ------------------------------------------------------------------ CF.Cong / CF.Data */

export function parseCfCong(get: CellGetter): PipeCatalog {
  const cat: PipeCatalog = { round: [], box: [], ditch: [] };
  for (let r = 4; r < 80; r++) {
    const d = get(`B${r}`);
    if (typeof d === 'number') cat.round.push({ d, t: num(get(`C${r}`)) });
    const b = get(`D${r}`);
    if (typeof b === 'number') cat.box.push({ b, h: num(get(`E${r}`)), t: num(get(`F${r}`)), chamfer: num(get(`G${r}`)), twin: yes(get(`H${r}`)) });
    const ub = get(`I${r}`);
    if (typeof ub === 'number') cat.ditch.push({ b: ub, h: num(get(`J${r}`)), t: num(get(`K${r}`)), chamfer: num(get(`L${r}`)) });
  }
  return cat;
}

export function parseCfData(get: CellGetter): { angles: Record<string, number>; blocks: string[] } {
  const angles: Record<string, number> = {};
  const blocks: string[] = [];
  for (let r = 4; r < 120; r++) {
    const n = str(get(`B${r}`));
    const w = get(`C${r}`);
    if (n && typeof w === 'number' && !/^kh[oô]ng$/i.test(n)) angles[n] = w;
    const bl = str(get(`I${r}`));
    if (bl) blocks.push(bl);
  }
  return { angles, blocks };
}

/* ------------------------------------------------------------------ CF.Ga */

interface Sec {
  title: string;
  row: number;
}

function findSections(get: CellGetter, maxRow = 80): Sec[] {
  const out: Sec[] = [];
  for (let r = 1; r < maxRow; r++) {
    const t = str(get(`B${r}`));
    if (t && t !== 'Tiền tố') out.push({ title: t, row: r });
  }
  return out;
}

/** Tìm cột có nhãn `label` ở hàng `row` (so khớp không phân biệt hoa thường, bỏ khoảng trắng thừa). */
function colOf(get: CellGetter, row: number, label: string): string | null {
  const want = label.toLowerCase().replace(/\s+/g, ' ');
  for (let i = 2; i < 20; i++) {
    const v = str(get(`${colAt(i)}${row}`)).toLowerCase().replace(/\s+/g, ' ');
    if (v === want) return colAt(i);
  }
  return null;
}

/** Đọc cấu hình CF.Ga và gộp lên cấu hình mặc định của loại ga. */
export function parseCfGa(kind: GaKind, get: CellGetter): GaConfig {
  const cfg = defaultConfig(kind);
  const info = GA_KINDS[kind];
  const secs = findSections(get);
  const sec = (re: RegExp) => secs.find((s) => re.test(s.title));
  /** giá trị ở cột của nhãn `label` (hàng tiêu đề `hr`), đọc ở hàng `vr` */
  const val = (hr: number, vr: number, label: string): unknown => {
    const c = colOf(get, hr, label);
    return c ? get(`${c}${vr}`) : undefined;
  };
  const set = <T,>(v: unknown, cb: (x: unknown) => T, assign: (x: T) => void) => {
    if (v !== undefined && v !== null && str(v) !== '') assign(cb(v));
  };

  let s = sec(/^Lớp lót$/);
  if (s) {
    const hr = s.row;
    set(val(hr, hr + 1, 'L1: Mở rộng'), num, (x) => (cfg.liner.l1Ext = x));
    set(val(hr, hr + 1, 'L1: Dày'), num, (x) => (cfg.liner.l1T = x));
    set(val(hr, hr + 1, 'L2: Mở rộng'), num, (x) => (cfg.liner.l2Ext = x));
    set(val(hr, hr + 1, 'L2: Dày'), num, (x) => (cfg.liner.l2T = x));
  }
  s = sec(/^Bản đáy ga$/);
  if (s) {
    set(val(s.row, s.row + 1, 'Mở rộng'), num, (x) => (cfg.bottom.ext = x));
    set(val(s.row, s.row + 1, 'Vát góc'), num, (x) => (cfg.bottom.chamfer = x));
    set(val(s.row, s.row + 1, 'ĐK thép vát'), num, (x) => (cfg.bottom.chamferDia = x));
    set(val(s.row, s.row + 1, 'Bẻ móc'), num, (x) => (cfg.bottom.hook = x));
  }
  s = sec(/^Tường ga$/);
  if (s) {
    const hr = s.row;
    set(val(hr, hr + 1, 'Thép ngang'), num, (x) => (cfg.wall.horizAdj = x));
    set(val(hr, hr + 1, 'Giảm thép'), num, (x) => (cfg.wall.dRed = x));
    set(val(hr, hr + 1, 'Tiền tố Dim'), str, (x) => (cfg.wall.prefix = x));
    if (!info.hasNeck) {
      cfg.wall.topChamfer.on = yes(val(hr, hr + 1, 'Vát đỉnh tường'));
      set(val(hr, hr + 1, 'KT vát đỉnh'), str, (x) => (cfg.wall.topChamfer.size = x));
      set(val(hr, hr + 1, 'Thép góc'), str, (x) => (cfg.wall.topChamfer.angle = x));
      set(val(hr, hr + 1, 'Vị trí'), str, (x) => (cfg.wall.topChamfer.pos = x));
      set(val(hr, hr + 1, 'Neo góc'), str, (x) => (cfg.wall.topChamfer.anchor = x));
    }
  }
  s = sec(/^Trần ga$/);
  if (s && info.hasNeck) {
    const hr = s.row;
    if (colOf(get, hr, 'Vát góc')) {
      set(val(hr, hr + 1, 'Vát góc'), num, (x) => (cfg.roof.chamfer = x));
      set(val(hr, hr + 1, 'ĐK thép vát'), num, (x) => (cfg.roof.chamferDia = x));
      set(val(hr, hr + 1, 'Bẻ móc'), num, (x) => (cfg.roof.hook = x));
    } else {
      cfg.precast.pin = yes(val(hr, hr + 1, 'Chốt thép'));
      const c0 = colOf(get, hr, 'Chốt thép');
      if (c0) {
        set(get(`${colAt(colIdx(c0) + 1)}${hr + 1}`), str, (x) => (cfg.precast.pinSpec = x));
        set(get(`${colAt(colIdx(c0) + 2)}${hr + 1}`), num, (x) => (cfg.precast.pinLen = x));
      }
      set(val(hr, hr + 1, 'ĐK lỗ chốt'), num, (x) => (cfg.precast.pinHole = x));
      set(val(hr, hr + 1, 'Vữa đệm'), num, (x) => (cfg.precast.mortar = x));
      set(val(hr, hr + 1, 'Móc nâng'), str, (x) => (cfg.precast.lift = x));
      set(val(hr, hr + 1, 'Kích thước móc'), str, (x) => (cfg.precast.liftSize = x));
      set(val(hr, hr + 1, 'Kích thước'), str, (x) => (cfg.precast.liftSize = x));
    }
  }
  s = sec(/^Cổ ga$/);
  if (s && info.hasNeck) {
    const hr = s.row;
    const v = (l: string) => val(hr, hr + 1, l);
    set(v('Kết cấu'), str, (x) => (cfg.neck.structure = /bt/i.test(x) ? 'BTCT' : 'Khác'));
    set(v('Vị trí'), str, (x) => (cfg.neck.pos = x));
    set(v('KT cổ ga'), str, (x) => (cfg.neck.size = x));
    cfg.neck.chamfer = yes(v('Vát cổ'));
    set(v('KT vát cổ'), str, (x) => (cfg.neck.chamferSize = x));
    set(v('Thép góc'), str, (x) => (cfg.neck.angle = x));
    // "Vị trí" xuất hiện hai lần: lần thứ hai (thép góc)
    const c2 = (() => {
      let first = true;
      for (let i = 2; i < 20; i++) {
        if (str(get(`${colAt(i)}${hr}`)).toLowerCase() === 'vị trí') {
          if (first) first = false;
          else return colAt(i);
        }
      }
      return null;
    })();
    if (c2) set(get(`${c2}${hr + 1}`), str, (x) => (cfg.neck.anglePos = x));
    set(v('Neo góc'), str, (x) => (cfg.neck.anchor = x));
    set(v('Tiền tố Dim'), str, (x) => (cfg.neck.prefix = x));
    set(v('Thép ngang'), num, (x) => (cfg.neck.horizAdj = x));
    set(v('Giảm thép'), num, (x) => (cfg.neck.dRed = x));
  }
  s = sec(/^Nắp ga$/);
  if (s) {
    const hr = s.row;
    if (info.hasNeck) {
      const v = (l: string) => val(hr, hr + 1, l);
      set(v('Loại nắp'), str, (x) => (cfg.lid.type = /bt/i.test(x) ? 'BTCT' : 'Gang'));
      set(v('Cao nắp'), num, (x) => (cfg.lid.height = x));
      set(v('Block nắp'), str, (x) => (cfg.lid.block = x));
      cfg.lid.recess = yes(v('Vát nắp'));
      set(v('KT vát nắp'), str, (x) => (cfg.lid.recessSize = x));
      set(v('Hatch'), str, (x) => (cfg.lid.hatch = x));
      set(v('Số tấm BTCT'), num, (x) => (cfg.lid.nSlabs = x));
      set(v('Khe hở'), num, (x) => (cfg.lid.gap = x));
      set(v('Chiều tấm'), str, (x) => (cfg.lid.dir = /d[oọ]c/i.test(x) ? 'Dọc' : 'Ngang'));
    } else {
      set(val(hr, hr + 2, 'Loại nắp'), str, (x) => (cfg.lid.type = /bt/i.test(x) ? 'BTCT' : 'Gang'));
      set(val(hr, hr + 2, 'Block nắp'), str, (x) => (cfg.lid.block = x));
      const sub = hr + 1;
      const w = (l: string) => val(sub, sub + 1, l);
      set(w('Số tấm BTCT'), num, (x) => (cfg.lid.nSlabs = x));
      set(w('Khe hở'), num, (x) => (cfg.lid.gap = x));
      set(w('Chiều tấm'), str, (x) => (cfg.lid.dir = /d[oọ]c/i.test(x) ? 'Dọc' : 'Ngang'));
      set(w('Thép góc'), str, (x) => (cfg.lid.angle = x));
      set(w('Số lượng'), num, (x) => (cfg.lid.angleCount = x));
      set(w('Neo góc'), str, (x) => (cfg.lid.anchor = x));
      set(w('Móc nâng'), str, (x) => (cfg.lid.lift = x));
      set(w('Kích thước'), str, (x) => (cfg.lid.liftSize = x));
    }
  }
  s = sec(/^Thép tấm nắp BTCT$/);
  if (s) {
    const hr = s.row;
    const v = (l: string) => val(hr, hr + 1, l);
    set(v('ĐK lớp dưới'), num, (x) => (cfg.lid.dLow = x));
    set(v('ĐK lớp trên'), num, (x) => (cfg.lid.dUp = x));
    set(v('Mật độ'), num, (x) => (cfg.lid.density = x));
    set(v('Thép buộc'), str, (x) => (cfg.lid.tie = x));
    set(v('Kiểu buộc'), str, (x) => (cfg.lid.tieShape = x));
    set(v('Thép góc'), str, (x) => (cfg.lid.angle = x));
    set(v('Số lượng'), num, (x) => (cfg.lid.angleCount = x));
    set(v('Neo góc'), str, (x) => (cfg.lid.anchor = x));
    set(v('Móc nâng'), str, (x) => (cfg.lid.lift = x));
    set(v('Kích thước'), str, (x) => (cfg.lid.liftSize = x));
    set(v('Tỷ lệ BV'), num, (x) => (cfg.lid.scale = x));
  }
  s = sec(/^Cửa thu nước$/);
  if (s && info.hasInlet) {
    const hr = s.row;
    const v = (l: string) => val(hr, hr + 1, l);
    set(v('Vị trí'), str, (x) => (cfg.inlet.place = /c[oổ]/i.test(x) && /ga/i.test(x) && /c[ổo]/i.test(x) && !/th[âa]n/i.test(x) ? 'Cổ ga' : 'Thân ga'));
    set(v('Hướng'), str, (x) => (cfg.inlet.side = x));
    set(v('Kích thước lỗ'), str, (x) => (cfg.inlet.hole = x));
    set(v('Dài x cao cửa'), str, (x) => (cfg.inlet.clear = x));
    set(v('Dày Tường x Đáy'), str, (x) => (cfg.inlet.thick = x));
    set(v('Dày x Mở rộng lót'), str, (x) => (cfg.inlet.liner = x));
    set(v('Giằng đỉnh'), str, (x) => (cfg.inlet.beam = x));
    set(v('Kết cấu'), str, (x) => (cfg.inlet.structure = /bt/i.test(x) ? 'BTCT' : 'Khác'));
    set(v('Cốt thép cửa'), str, (x) => (cfg.inlet.mesh = x));
    const cm = colOf(get, hr, 'Cốt thép giằng');
    if (cm) {
      set(get(`${cm}${hr + 1}`), str, (x) => (cfg.inlet.beamMain = x));
      set(get(`${cm}${hr + 2}`), str, (x) => (cfg.inlet.beamStirrup = x));
    }
  }
  s = sec(/^Lớp bê tông bảo vệ$/);
  if (s) {
    const hr = s.row;
    const v = (l: string) => val(hr, hr + 1, l);
    set(v('Đáy'), num, (x) => (cfg.cover.bottom = x));
    set(v('Tường'), num, (x) => (cfg.cover.wall = x));
    set(v('Trần'), num, (x) => (cfg.cover.roof = x));
    set(v('Cổ'), num, (x) => (cfg.cover.neck = x));
    set(v('Nắp'), num, (x) => (cfg.cover.lid = x));
    set(v('Lỗ cống, rãnh'), num, (x) => (cfg.cover.pipe = x));
    set(v('Cửa thu'), num, (x) => (cfg.cover.inlet = x));
    set(v('Tỷ lệ not thép'), num, (x) => (cfg.cover.notch = x));
  }
  s = sec(/^Định dạng thép ga$/);
  if (s) {
    const hr = s.row;
    const hooksRow = hr + 2;
    const prefRow = hr + 3;
    const g = (c: string, r: number) => get(`${c}${r}`);
    set(g('C', hooksRow), str, (x) => (cfg.fmt.bottomLow = x));
    set(g('D', hooksRow), str, (x) => (cfg.fmt.bottomUp = x));
    set(g('E', hooksRow), str, (x) => (cfg.fmt.wallOut = x));
    set(g('F', hooksRow), str, (x) => (cfg.fmt.wallIn = x));
    set(g('G', hooksRow), str, (x) => (cfg.fmt.roofUp = x));
    set(g('H', hooksRow), str, (x) => (cfg.fmt.roofLow = x));
    if (info.hasNeck) {
      set(g('I', hooksRow), str, (x) => (cfg.fmt.neckOut = x));
      set(g('J', hooksRow), str, (x) => (cfg.fmt.neckIn = x));
    }
    const mc = info.hasNeck ? 'K' : 'I';
    const hc = info.hasNeck ? 'L' : 'J';
    const sc = info.hasNeck ? 'M' : 'K';
    set(g(mc, hr + 1), str, (x) => (cfg.fmt.mesh = /ch[iì]a/i.test(x) ? 'Chia đều' : 'Theo mật độ'));
    set(g(hc, hr + 1), str, (x) => (cfg.fmt.hook = /KC/i.test(x) ? 'Theo KC' : 'Theo ĐK'));
    set(g(sc, hr + 1), str, (x) => (cfg.fmt.densSym = x));
    set(g(hc, prefRow), num, (x) => (cfg.fmt.hookN = x));
    cfg.fmt.showCount = yes(g(sc, prefRow));
    set(g('C', prefRow), str, (x) => (cfg.fmt.prefixes.bottom = x));
    set(g('E', prefRow), str, (x) => (cfg.fmt.prefixes.wall = x));
    set(g('G', prefRow), str, (x) => (cfg.fmt.prefixes.roof = x));
    if (info.hasNeck) set(g('I', prefRow), str, (x) => (cfg.fmt.prefixes.neck = x));
  }
  s = sec(/^Thép buộc$/);
  if (s) {
    const hr = s.row;
    const v = (l: string) => val(hr, hr + 1, l);
    set(v('Bố trí'), str, (x) => (cfg.ties.stagger = /l[eệ]ch/i.test(x) ? 'Lệch' : 'Đều'));
    set(v('Đáy'), str, (x) => (cfg.ties.bottom = x));
    set(v('Tường'), str, (x) => (cfg.ties.wall = x));
    set(v('Trần'), str, (x) => (cfg.ties.roof = x));
    set(v('Cổ'), str, (x) => (cfg.ties.neck = x));
    set(v('Đường kính'), str, (x) => (cfg.ties.spec = x));
    set(v('L nối thép'), num, (x) => (cfg.ties.lap = x));
    set(v('L móc C'), num, (x) => (cfg.ties.hookC = x));
    set(v('L móc Z+U'), num, (x) => (cfg.ties.hookZU = x));
    set(v('L móc giữa U'), num, (x) => (cfg.ties.hookMid = x));
  }
  s = sec(/^Thang thép$/);
  if (s) {
    const hr = s.row;
    const v = (l: string) => val(hr, hr + 1, l);
    set(v('Vị trí'), str, (x) => (cfg.ladder.pos = x));
    set(v('Đường kính'), num, (x) => (cfg.ladder.dia = x));
    set(v('Mật độ'), str, (x) => (cfg.ladder.dens = x));
    set(v('Kích thước'), str, (x) => (cfg.ladder.size = x));
    set(v('Độ sâu'), num, (x) => (cfg.ladder.depth = x));
    set(v('Tiền tố'), str, (x) => (cfg.ladder.prefix = x));
  }
  s = sec(/^Lỗ cống, rãnh$/);
  if (s) {
    const hr = s.row;
    set(val(hr, hr + 2, 'Chiều dày vữa trát'), num, (x) => (cfg.pipeHole.plaster = x));
    const sub = hr + 1;
    const v = (l: string) => val(sub, sub + 1, l);
    set(v('Đường kính'), num, (x) => (cfg.pipeHole.dia = x));
    set(v('Hình thức'), str, (x) => (cfg.pipeHole.form = x));
    set(v('Số lượng'), num, (x) => (cfg.pipeHole.count = x));
    set(v('Mở rộng'), num, (x) => (cfg.pipeHole.ext = x));
    set(v('Tiền tố'), str, (x) => (cfg.pipeHole.prefix = x));
    (['Cống T1', 'Cống T2', 'Cống T3', 'Cống T4'] as const).forEach((l, i) => {
      set(v(l), num, (x) => (cfg.pipeHole.offsets[i] = x));
    });
  }
  s = sec(/^Lỗ thăm$/);
  if (s) {
    const hr = s.row;
    const v = (l: string) => val(hr, hr + 1, l);
    set(v('Đường kính'), num, (x) => (cfg.manHole.dia = x));
    set(v('Hình thức'), str, (x) => (cfg.manHole.form = x));
    set(v('Số lượng'), num, (x) => (cfg.manHole.count = x));
    set(v('Mở rộng'), num, (x) => (cfg.manHole.ext = x));
    set(v('Tiền tố'), str, (x) => (cfg.manHole.prefix = x));
  }
  s = sec(/^Cao trình ga$/);
  if (s) {
    const hr = s.row;
    const mode = val(hr, hr + 1, 'Hình thức');
    if (str(mode)) cfg.levels.mode = /t[uư][oơ]ng/i.test(str(mode)) ? 'Tương đối' : 'Tuyệt đối';
    ['Đáy ga', 'Đỉnh ga', 'Cống T1', 'Cống T2', 'Cống T3', 'Cống T4'].forEach((l, i) => set(val(hr, hr + 1, l), str, (x) => (cfg.levels.labels[i] = x)));
  }
  s = sec(/^Ghi chú vật liệu$/);
  if (s) {
    const hr = s.row;
    const v = (l: string) => val(hr, hr + 1, l);
    set(v('Lớp lót 1'), str, (x) => (cfg.materials.liner1 = x));
    set(v('Lớp lót 2'), str, (x) => (cfg.materials.liner2 = x));
    set(v('Hố ga'), str, (x) => (cfg.materials.body = x));
    set(v('Cổ ga'), str, (x) => (cfg.materials.neck = x));
    set(v('Nắp ga'), str, (x) => (cfg.materials.neck = x));
    set(v('Vữa trát'), str, (x) => (cfg.materials.plaster = x));
    set(v('Vữa đệm'), str, (x) => (cfg.materials.mortar = x));
  }
  return cfg;
}

/* ------------------------------------------------------------------ toàn tệp */

export interface ImportResult {
  project: HoGaProject;
  warnings: string[];
}

export interface SheetReader {
  names: string[];
  cell(sheet: string, addr: string): unknown;
}

export function detectKind(names: string[]): GaKind | null {
  for (const k of GA_KIND_ORDER) if (names.includes(GA_KINDS[k].sheet)) return k;
  return null;
}

/** Phân tích một workbook đã được trừu tượng hoá bằng `SheetReader`. */
export function importWorkbook(reader: SheetReader, title = 'Dự án nhập từ Excel'): ImportResult {
  const warnings: string[] = [];
  const kind = detectKind(reader.names);
  if (!kind) throw new Error('Không tìm thấy sheet chi tiết ga (GaThamLienKhoi, GaThamNapRoi, GaThamThuNapRoi, GaThamThuLienKhoi hoặc GaThamKhongCo).');
  const sheet = GA_KINDS[kind].sheet;
  const p = defaultProject(kind);
  p.title = title;
  const rows = parseGaRows(kind, (a) => reader.cell(sheet, a));
  if (!rows.length) warnings.push('Sheet chi tiết ga không có dòng dữ liệu – giữ dữ liệu mẫu.');
  else p.rows = rows;
  if (reader.names.includes('CF.Ga')) p.config = parseCfGa(kind, (a) => reader.cell('CF.Ga', a));
  else warnings.push('Không có sheet CF.Ga – dùng cấu hình mặc định.');
  if (reader.names.includes('CF.Cong')) {
    const cat = parseCfCong((a) => reader.cell('CF.Cong', a));
    if (cat.round.length || cat.box.length || cat.ditch.length) p.catalog = cat;
  }
  if (reader.names.includes('CF.Data')) {
    const d = parseCfData((a) => reader.cell('CF.Data', a));
    if (Object.keys(d.angles).length) p.angles = d.angles;
  }
  return { project: p, warnings };
}

/** Đọc tệp .xlsx trong trình duyệt bằng exceljs (nạp theo yêu cầu). */
export async function importXlsxFile(buf: ArrayBuffer, title?: string): Promise<ImportResult> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const names = wb.worksheets.map((w) => w.name);
  const reader: SheetReader = {
    names,
    cell(sheet, addr) {
      const ws = wb.getWorksheet(sheet);
      if (!ws) return undefined;
      const v = ws.getCell(addr).value as unknown;
      if (v && typeof v === 'object') {
        const o = v as { result?: unknown; richText?: { text: string }[]; text?: string };
        if ('result' in o) return o.result;
        if (o.richText) return o.richText.map((t) => t.text).join('');
        if (o.text !== undefined) return o.text;
      }
      return v;
    },
  };
  return importWorkbook(reader, title);
}
