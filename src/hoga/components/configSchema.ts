import type { GaKindInfo } from '../engine/types';

export interface Field {
  path: string;
  label: string;
  type: 'num' | 'text' | 'bool' | 'select';
  options?: string[];
  unit?: string;
  hint?: string;
}
export interface Group {
  id: string;
  title: string;
  show?: (i: GaKindInfo) => boolean;
  fields: Field[];
}

const n = (path: string, label: string, unit = 'mm', hint?: string): Field => ({ path, label, type: 'num', unit, hint });
const t = (path: string, label: string, hint?: string): Field => ({ path, label, type: 'text', hint });
const b = (path: string, label: string): Field => ({ path, label, type: 'bool' });
const s = (path: string, label: string, options: string[], hint?: string): Field => ({ path, label, type: 'select', options, hint });

const HOOKS = ['0M', '1M', '2M'];
const TIE_SHAPES = ['Chữ C', 'Chữ Z', 'Chữ U'];
const NECK_POS = ['Giữa ga', 'Giữa T1', 'Giữa T2', 'Giữa T3', 'Giữa T4', 'Góc T1-T2', 'Góc T2-T3', 'Góc T3-T4', 'Góc T4-T1'];

export const CONFIG_GROUPS: Group[] = [
  { id: 'liner', title: 'Lớp lót', fields: [n('liner.l1Ext', 'Lớp 1: mở rộng'), n('liner.l1T', 'Lớp 1: dày', 'mm', '0 = không có lớp lót'), n('liner.l2Ext', 'Lớp 2: mở rộng'), n('liner.l2T', 'Lớp 2: dày', 'mm', '0 = không có lớp lót 2')] },
  {
    id: 'bottom',
    title: 'Bản đáy',
    fields: [n('bottom.ext', 'Mở rộng ngoài tường'), n('bottom.chamfer', 'Vát góc trong', 'mm', '0 = không vát'), n('bottom.chamferDia', 'ĐK thép vát', 'mm', '0 = không vẽ thép vát'), n('bottom.hook', 'Chiều dài bẻ móc thép vát')],
  },
  {
    id: 'wall',
    title: 'Tường ga',
    fields: [n('wall.horizAdj', 'Thép ngang: chênh mật độ', 'mm', 'VD thép đứng A150, nhập 50 → ngang A200'), n('wall.dRed', 'Giảm đường kính thép ngang', 'cấp', 'Nhập 1: D12 → D10'), t('wall.prefix', 'Tiền tố kích thước cao')],
  },
  {
    id: 'topChamfer',
    title: 'Vát đỉnh tường (ga không cổ)',
    show: (i) => !i.hasNeck,
    fields: [b('wall.topChamfer.on', 'Vát đỉnh tường'), t('wall.topChamfer.size', 'Kích thước vát (BxH)'), t('wall.topChamfer.angle', 'Thép góc (V50x50x3)'), t('wall.topChamfer.pos', 'Vị trí thép góc (1,2,3)'), t('wall.topChamfer.anchor', 'Râu neo (D6A150L100)')],
  },
  { id: 'roof', title: 'Trần ga liền khối', show: (i) => i.hasNeck && !i.precastRoof, fields: [n('roof.chamfer', 'Vát góc tường–trần'), n('roof.chamferDia', 'ĐK thép vát'), n('roof.hook', 'Chiều dài bẻ móc')] },
  {
    id: 'precast',
    title: 'Trần ga đúc sẵn',
    show: (i) => i.hasNeck && i.precastRoof,
    fields: [b('precast.pin', 'Bố trí chốt thép'), t('precast.pinSpec', 'Chốt thép (D18A500)'), n('precast.pinLen', 'Chiều dài chốt'), n('precast.pinHole', 'ĐK lỗ chốt'), n('precast.mortar', 'Vữa đệm'), t('precast.lift', 'Móc nâng (2D12)'), t('precast.liftSize', 'Kích thước móc (AxBxC)')],
  },
  {
    id: 'neck',
    title: 'Cổ ga',
    show: (i) => i.hasNeck,
    fields: [
      s('neck.structure', 'Kết cấu', ['BTCT', 'Khác']),
      s('neck.pos', 'Vị trí cổ', NECK_POS),
      t('neck.size', 'Kích thước trong', 'BxL (700x800) hoặc DA (D700)'),
      b('neck.chamfer', 'Vát cổ'),
      t('neck.chamferSize', 'Kích thước vát (BxH)'),
      t('neck.angle', 'Thép góc'),
      t('neck.anglePos', 'Vị trí thép góc (1,2,3)'),
      t('neck.anchor', 'Râu neo (D6A150L100)'),
      t('neck.prefix', 'Tiền tố kích thước cổ'),
      n('neck.horizAdj', 'Thép ngang: chênh mật độ'),
      n('neck.dRed', 'Giảm đường kính thép ngang', 'cấp'),
    ],
  },
  {
    id: 'lid',
    title: 'Nắp ga / tấm nắp',
    fields: [
      s('lid.type', 'Loại nắp', ['Gang', 'BTCT']),
      n('lid.height', 'Cao nắp', 'mm', 'Chỉ dùng cho ga có cổ'),
      t('lid.block', 'Block nắp'),
      b('lid.recess', 'Vát nắp'),
      t('lid.recessSize', 'KT vát nắp (BxH)'),
      n('lid.nSlabs', 'Số tấm BTCT', 'tấm'),
      n('lid.gap', 'Khe hở'),
      s('lid.dir', 'Chiều tấm', ['Ngang', 'Dọc']),
      n('lid.dLow', 'ĐK lớp dưới', 'mm', 'Ga có cổ; ga không cổ lấy theo bảng ga'),
      n('lid.dUp', 'ĐK lớp trên', 'mm', '0 = một lớp'),
      n('lid.density', 'Mật độ lưới'),
      t('lid.tie', 'Thép buộc (D6A400)'),
      s('lid.tieShape', 'Kiểu thép buộc', TIE_SHAPES),
      t('lid.angle', 'Thép góc viền tấm'),
      n('lid.angleCount', 'Số viền thép góc', 'lớp', '1 = dưới, 2 = dưới và trên'),
      t('lid.anchor', 'Râu neo'),
      t('lid.lift', 'Móc nâng (2D8)'),
      t('lid.liftSize', 'Kích thước móc'),
      n('lid.scale', 'Tỷ lệ chi tiết tấm nắp', '1/n'),
    ],
  },
  {
    id: 'inlet',
    title: 'Cửa thu nước',
    show: (i) => i.hasInlet,
    fields: [
      s('inlet.place', 'Vị trí', ['Thân ga', 'Cổ ga']),
      t('inlet.side', 'Hướng', 'VD: Giữa T4'),
      t('inlet.hole', 'Kích thước lỗ (rộng x cao)'),
      t('inlet.clear', 'Lòng cửa thu (dài x cao)'),
      t('inlet.thick', 'Dày tường x đáy'),
      t('inlet.liner', 'Dày x mở rộng lớp lót'),
      t('inlet.beam', 'Giằng đỉnh (BxH)'),
      s('inlet.structure', 'Kết cấu', ['BTCT', 'Khác']),
      t('inlet.mesh', 'Cốt thép cửa (D10A150)'),
      t('inlet.beamMain', 'Thép chủ giằng (4D12)'),
      t('inlet.beamStirrup', 'Thép đai giằng (D6A150)'),
    ],
  },
  {
    id: 'cover',
    title: 'Lớp bê tông bảo vệ',
    fields: [n('cover.bottom', 'Bản đáy'), n('cover.wall', 'Tường'), n('cover.roof', 'Trần'), n('cover.neck', 'Cổ'), n('cover.lid', 'Nắp'), n('cover.pipe', 'Lỗ cống, rãnh'), n('cover.inlet', 'Cửa thu'), n('cover.notch', 'Tỷ lệ nốt thép')],
  },
  {
    id: 'fmt',
    title: 'Định dạng thép',
    fields: [
      s('fmt.bottomLow', 'Đáy – lớp dưới', HOOKS),
      s('fmt.bottomUp', 'Đáy – lớp trên', HOOKS),
      s('fmt.wallOut', 'Tường – lớp ngoài', HOOKS),
      s('fmt.wallIn', 'Tường – lớp trong', HOOKS),
      s('fmt.roofUp', 'Trần – lớp trên', HOOKS),
      s('fmt.roofLow', 'Trần – lớp dưới', HOOKS),
      s('fmt.neckOut', 'Cổ – lớp ngoài', HOOKS),
      s('fmt.neckIn', 'Cổ – lớp trong', HOOKS),
      s('fmt.mesh', 'Bố trí lưới thép', ['Chia đều', 'Theo mật độ'], 'Chia đều: khoảng cách ≤ mật độ; Theo mật độ: đúng mật độ, dư chia hai bên'),
      s('fmt.hook', 'Bẻ móc', ['Theo KC', 'Theo ĐK'], 'Theo KC: dày kết cấu − 2 lớp bảo vệ; Theo ĐK: n × đường kính'),
      n('fmt.hookN', 'Số lần đường kính (bẻ móc)', 'lần'),
      t('fmt.densSym', 'Ký hiệu mật độ'),
      t('fmt.prefixes.bottom', 'Tiền tố thép đáy'),
      t('fmt.prefixes.wall', 'Tiền tố thép tường'),
      t('fmt.prefixes.roof', 'Tiền tố thép trần'),
      t('fmt.prefixes.neck', 'Tiền tố thép cổ'),
      t('fmt.prefixes.lid', 'Tiền tố thép nắp'),
    ],
  },
  {
    id: 'ties',
    title: 'Thép buộc',
    fields: [s('ties.stagger', 'Bố trí', ['Đều', 'Lệch']), s('ties.bottom', 'Đáy', TIE_SHAPES), s('ties.wall', 'Tường', TIE_SHAPES), s('ties.roof', 'Trần', TIE_SHAPES), s('ties.neck', 'Cổ', TIE_SHAPES), t('ties.spec', 'Đường kính & mật độ (D6A300)'), n('ties.lap', 'Nối thép', 'lần ĐK'), n('ties.hookC', 'Móc chữ C'), n('ties.hookZU', 'Móc chữ Z, U'), n('ties.hookMid', 'Móc giữa chữ U')],
  },
  {
    id: 'ladder',
    title: 'Thang thép',
    fields: [s('ladder.pos', 'Vị trí', ['Không', 'T1', 'T2', 'T3', 'T4', 'Theo vị trí cổ']), n('ladder.dia', 'Đường kính'), t('ladder.dens', 'Mật độ (AxB)'), t('ladder.size', 'Kích thước (MxHxB)'), n('ladder.depth', 'Độ sâu bậc'), t('ladder.prefix', 'Tiền tố')],
  },
  {
    id: 'pipeHole',
    title: 'Lỗ cống, rãnh',
    fields: [
      n('pipeHole.plaster', 'Chiều dày vữa trát', 'mm', '0 = không trát'),
      n('pipeHole.dia', 'ĐK thép gia cường', 'mm', '0 = không vẽ'),
      s('pipeHole.form', 'Hình thức', ['Bo', 'Xiên', 'Vuông', 'Bo+Xiên', 'Bo+Vuông']),
      n('pipeHole.count', 'Số lượng'),
      n('pipeHole.ext', 'Mở rộng'),
      t('pipeHole.prefix', 'Tiền tố'),
      n('pipeHole.offsets.0', 'Lệch tim cống T1'),
      n('pipeHole.offsets.1', 'Lệch tim cống T2'),
      n('pipeHole.offsets.2', 'Lệch tim cống T3'),
      n('pipeHole.offsets.3', 'Lệch tim cống T4'),
    ],
  },
  { id: 'manHole', title: 'Lỗ thăm', show: (i) => i.hasNeck, fields: [n('manHole.dia', 'ĐK thép gia cường'), s('manHole.form', 'Hình thức', ['Bo', 'Vuông', 'Bo+Vuông']), n('manHole.count', 'Số lượng'), n('manHole.ext', 'Mở rộng'), t('manHole.prefix', 'Tiền tố')] },
  {
    id: 'levels',
    title: 'Cao trình',
    fields: [
      s('levels.mode', 'Hình thức', ['Tuyệt đối', 'Tương đối'], 'Tuyệt đối: tính từ cao độ đáy ga; Tương đối: ghi ký hiệu'),
      t('levels.labels.0', 'Ký hiệu đáy ga'),
      t('levels.labels.1', 'Ký hiệu đỉnh ga'),
      t('levels.labels.2', 'Ký hiệu đáy cống T1'),
      t('levels.labels.3', 'Ký hiệu đáy cống T2'),
      t('levels.labels.4', 'Ký hiệu đáy cống T3'),
      t('levels.labels.5', 'Ký hiệu đáy cống T4'),
    ],
  },
  { id: 'materials', title: 'Ghi chú vật liệu', fields: [t('materials.liner1', 'Lớp lót 1'), t('materials.liner2', 'Lớp lót 2'), t('materials.body', 'Hố ga'), t('materials.neck', 'Cổ ga / nắp'), t('materials.plaster', 'Vữa trát'), t('materials.mortar', 'Vữa đệm')] },
  { id: 'excavation', title: 'Đào đắp', fields: [n('excavation.sandT', 'Cát lót (dày)'), n('excavation.baseExt', 'Mở rộng đáy hố móng'), { path: 'excavation.slope', label: 'Hệ số mái đào', type: 'num', unit: 'm/m' }, n('excavation.h0Dig', 'H0 đào'), n('excavation.h0Fill', 'H0 đắp')] },
];

export function getPath(o: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((a, k) => (a === null || a === undefined ? undefined : (a as Record<string, unknown>)[k]), o);
}

export function setPath<T>(o: T, path: string, v: unknown): T {
  const keys = path.split('.');
  const root = structuredClone(o) as Record<string, unknown>;
  let cur: Record<string, unknown> = root;
  for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]] as Record<string, unknown>;
  cur[keys[keys.length - 1]] = v;
  return root as unknown as T;
}
