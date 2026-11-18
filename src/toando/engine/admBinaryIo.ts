import type {
  AppliedAxleLoadType,
  CalculationYearMode,
  DesignKindType,
  DesignObjectType,
  MaterialRecord,
  PavementAlternative,
  PavementLayer,
  ProjectState,
  RoadType,
  StandardAxleType,
  SurfaceGrade,
  VehicleRow,
  WheelGroupType,
} from '../types/project';
import { STANDARD_AXLE_PARAMS } from '../data/tables22tcn211';

export const ADM_V1_ERROR_MESSAGE =
  'Format của file không đúng.\nLưu ý: file version 1.0 không mở được ở phiên bản này.';

const HEADER_MAGIC = 'ADM ver 2.0';
const HEADER_AUX_PROJECT = new Uint8Array([0xba, 0xc0, 0x61, 0xa7, 0x1f]);
const HEADER_AUTHOR = 'Written by Pham An Duy (C) 2016';
const HEADER_TAIL_VATLIEU = new Uint8Array([0xfe, 0x66, 0x07, 0x98, 0x08, 0x18, 0x00, 0xc8, 0xfe]);
const TAG4_BYTES = new Uint8Array([0x01, 0x09, 0x01, 0x00]);
const SECTION_PROJECT = 'DataProject';
const SECTION_VATLIEU = 'DataVatLieu';

class BinaryReader {
  private readonly view: DataView;
  private readonly bytes: Uint8Array;
  public offset = 0;

  constructor(input: ArrayBuffer | Uint8Array) {
    if (ArrayBuffer.isView(input)) {
      this.bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
      this.view = new DataView(input.buffer, input.byteOffset, input.byteLength);
    } else {
      this.bytes = new Uint8Array(input);
      this.view = new DataView(this.bytes.buffer);
    }
  }

  get length(): number {
    return this.bytes.byteLength;
  }

  ensure(n: number): void {
    if (this.offset + n > this.bytes.byteLength) {
      throw new Error('Unexpected end of ADM binary file.');
    }
  }

  readBytes(n: number): Uint8Array {
    this.ensure(n);
    const slice = this.bytes.slice(this.offset, this.offset + n);
    this.offset += n;
    return slice;
  }

  readAscii(n: number): string {
    const slice = this.readBytes(n);
    let s = '';
    for (let i = 0; i < slice.length; i++) {
      s += String.fromCharCode(slice[i]);
    }
    return s;
  }

  readU8(): number {
    this.ensure(1);
    const v = this.view.getUint8(this.offset);
    this.offset += 1;
    return v;
  }

  readU32(): number {
    this.ensure(4);
    const v = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return v;
  }

  readF64(): number {
    this.ensure(8);
    const v = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return v;
  }

  expectTag4(): void {
    const b = this.readBytes(4);
    for (let i = 0; i < 4; i++) {
      if (b[i] !== TAG4_BYTES[i]) {
        throw new Error(`Invalid ADM record marker at offset ${this.offset - 4}.`);
      }
    }
  }

  readU16String(): string {
    const charLen = this.readU32();
    const byteLen = charLen * 2;
    this.ensure(byteLen);
    const slice = this.bytes.subarray(this.offset, this.offset + byteLen);
    this.offset += byteLen;
    let out = '';
    for (let i = 0; i < slice.length; i += 2) {
      out += String.fromCharCode(slice[i] | (slice[i + 1] << 8));
    }
    return out;
  }
}

class BinaryWriter {
  private buf: number[] = [];

  writeBytes(bytes: Uint8Array | number[]): void {
    for (let i = 0; i < bytes.length; i++) {
      this.buf.push(bytes[i] & 0xff);
    }
  }

  writeAscii(text: string): void {
    for (let i = 0; i < text.length; i++) {
      this.buf.push(text.charCodeAt(i) & 0xff);
    }
  }

  writeU8(v: number): void {
    this.buf.push(v & 0xff);
  }

  writeU32(v: number): void {
    const tmp = new ArrayBuffer(4);
    new DataView(tmp).setUint32(0, v >>> 0, true);
    this.writeBytes(new Uint8Array(tmp));
  }

  writeF64(v: number): void {
    const tmp = new ArrayBuffer(8);
    new DataView(tmp).setFloat64(0, v, true);
    this.writeBytes(new Uint8Array(tmp));
  }

  writeTag4(): void {
    this.writeBytes(TAG4_BYTES);
  }

  writeU16String(text: string): void {
    this.writeU32(text.length);
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      this.buf.push(code & 0xff, (code >> 8) & 0xff);
    }
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.buf);
  }
}

function validateHeaderAndTag(reader: BinaryReader, expectedTag: string): void {
  if (reader.length < 56 + expectedTag.length) {
    throw new Error(ADM_V1_ERROR_MESSAGE);
  }
  const magic = reader.readAscii(11);
  if (magic !== HEADER_MAGIC) {
    throw new Error(ADM_V1_ERROR_MESSAGE);
  }
  // Skip remaining 45 bytes of 56-byte header
  reader.readBytes(45);
  const tag = reader.readAscii(expectedTag.length);
  if (tag !== expectedTag) {
    throw new Error(ADM_V1_ERROR_MESSAGE);
  }
}

function writeCommonHeader(writer: BinaryWriter, tailBytes: Uint8Array, sectionTag: string): void {
  writer.writeAscii(HEADER_MAGIC);
  writer.writeBytes(HEADER_AUX_PROJECT);
  writer.writeAscii(HEADER_AUTHOR);
  writer.writeBytes(tailBytes);
  writer.writeAscii(sectionTag);
}

function decodeDoiTuong(code: number): DesignObjectType {
  return code === 2 ? 'LGC' : 'KCAD';
}

function encodeDoiTuong(v: DesignObjectType): number {
  return v === 'LGC' ? 2 : 1;
}

function decodeLoaiTK(code: number): DesignKindType {
  return code === 2 ? 'CAI_TAO' : 'TK_MOI';
}

function encodeLoaiTK(v: DesignKindType): number {
  return v === 'CAI_TAO' ? 2 : 1;
}

function decodeLoaiDuong(code: number): RoadType {
  return code === 1 ? 'DUONG_DO_THI' : 'DUONG_O_TO';
}

function encodeLoaiDuong(v: RoadType): number {
  return v === 'DUONG_DO_THI' ? 1 : 2;
}

function decodeWheelGroup(code: number): WheelGroupType {
  if (code === 0) return 'DON';
  if (code === 2) return 'BON';
  return 'DOI';
}

function encodeWheelGroup(v: WheelGroupType): number {
  if (v === 'DON') return 0;
  if (v === 'BON') return 2;
  return 1;
}

function decodeNamTT(code: number): CalculationYearMode {
  return code === 0 ? 'NAM_DAU' : 'NAM_CUOI';
}

function encodeNamTT(v: CalculationYearMode): number {
  return v === 'NAM_DAU' ? 0 : 1;
}

function decodeAppliedAxle(code: number): AppliedAxleLoadType {
  return code === 1 ? 'BANH_DON' : 'BANH_DOI';
}

function encodeAppliedAxle(v: AppliedAxleLoadType): number {
  return v === 'BANH_DON' ? 1 : 0;
}

function decodeStandardAxle(code: number): StandardAxleType {
  return code === 1 ? 120 : 100;
}

function encodeStandardAxle(v: StandardAxleType): number {
  return v === 120 ? 1 : 0;
}

function decodeSurfaceGrade(code: number): SurfaceGrade {
  if (code === 1) return 'A2';
  if (code === 2) return 'B1';
  if (code === 3) return 'B2';
  return 'A1';
}

function encodeSurfaceGrade(v: SurfaceGrade): number {
  if (v === 'A2') return 1;
  if (v === 'B1') return 2;
  if (v === 'B2') return 3;
  return 0;
}

export function parseAdmProject(buffer: ArrayBuffer | Uint8Array): ProjectState {
  const r = new BinaryReader(buffer);
  validateHeaderAndTag(r, SECTION_PROJECT);

  const nPA = r.readU32();
  const paNames: string[] = [];
  for (let i = 0; i < nPA; i++) {
    r.expectTag4();
    paNames.push(r.readU16String());
  }

  // Project Info
  r.expectTag4();
  const congTrinh = r.readU16String();
  const diaDiem = r.readU16String();
  const kySuThietKe = r.readU16String();
  const doiTuongTKCode = r.readU8();
  const loaiTKCode = r.readU8();

  // Road Scale
  r.expectTag4();
  const loaiDuongCode = r.readU8();
  const capDuong = r.readU16String();
  const doTinCayTK = r.readF64();
  const gpcByte = r.readU8();
  const _gpcExtra = r.readU8();
  const soLanXe = r.readU32();
  const vanTocTK_kmh = r.readU32();
  const heSoLan_fL = r.readF64();
  const Kcd_vong = r.readF64();
  const Kcd_truot = r.readF64();
  const Kcd_keoUon = r.readF64();

  // Fleet
  r.expectTag4();
  const nXe = r.readU32();
  const _u1 = r.readU32();
  const _u2 = r.readU32();
  const vehicles: VehicleRow[] = [];
  for (let i = 0; i < nXe; i++) {
    const cumBanhCode = r.readU8();
    const peekNoKc = i === 0;
    // Note: in ADM ver 2.0, rows with 0 rear axles (index 0 passenger cars) omit khoangCach f64
    let khoangCach = 0;
    let luuLuong = 0;
    let soTrucSau = 0;
    if (peekNoKc) {
      luuLuong = r.readU32();
      soTrucSau = r.readU32();
    } else {
      khoangCach = r.readF64();
      luuLuong = r.readU32();
      soTrucSau = r.readU32();
    }
    const tenXe = r.readU16String();
    const tlTrucSau_kN = r.readF64();
    const tlTrucTruoc_kN = r.readF64();
    const flag = r.readU8();
    vehicles.push({
      id: `xe-${i}`,
      tenXe,
      tlTrucTruoc_kN,
      tlTrucSau_kN,
      soTrucSau,
      cumBanhTrucSau: decodeWheelGroup(cumBanhCode),
      khoangCachTrucSau_m: khoangCach,
      luuLuong_xeNgDem: luuLuong,
      flag,
    });
  }
  const _nXeTail = r.readU32();
  const storedNtk = r.readF64();
  const _endBool = r.readU8();

  // Forecast
  r.expectTag4();
  const thoiHanTK_nam = r.readU32();
  const quyLuatTangTruong_q = r.readF64();
  const namTTCode = r.readU8();
  const tttdCode = r.readU8();
  const tlqdCode = r.readU8();
  const D_cm = r.readF64();
  const p_MPa = r.readF64();
  const tlTrucQuyDoi_kN = decodeStandardAxle(tlqdCode);

  // Subgrade
  r.expectTag4();
  const xdDoAm = r.readU8() !== 0;
  const loaiDat = r.readU16String();
  const doAmTuongDoi_a = r.readF64();
  const doChatYeuCau_K = r.readF64();
  const lanSoiSan = r.readU8() !== 0;
  const phi_deg = r.readF64();
  const flag2 = r.readU8();
  const E0_MPa = r.readF64();
  const C_MPa = r.readF64();

  // Design params
  r.expectTag4();
  const loaiTMCode = r.readU8();
  const Emin_MPa = r.readF64();
  const Eyc_MPa = r.readF64();
  const Ett_MPa = r.readF64();

  // Pavement alternatives
  const alternatives: PavementAlternative[] = [];
  for (let i = 0; i < nPA; i++) {
    r.expectTag4();
    const nLayers = r.readU32();
    const layers: PavementLayer[] = [];
    for (let j = 0; j < nLayers; j++) {
      const tenVatLieu = r.readU16String();
      const E_vong_30C = r.readF64();
      const E_truot_60C = r.readF64();
      const E_keoUon_10_15C = r.readF64();
      const Rku_MPa = r.readF64();
      const C_layer = r.readF64();
      const phi_layer = r.readF64();
      const chieuDay_cm = r.readF64();
      const isTangMat = r.readU8() !== 0;
      const sttTrongTang = r.readU32();
      const ghiChu = r.readU16String();
      layers.push({
        id: `pa${i + 1}-l${j + 1}`,
        tang: isTangMat ? 'TANG_MAT' : 'TANG_MONG',
        isTangMat,
        sttTrongTang,
        tenVatLieu,
        chieuDay_cm,
        E_vong_30C,
        E_truot_60C,
        E_keoUon_10_15C,
        Rku_MPa,
        C_MPa: C_layer,
        phi_deg: phi_layer,
        ghiChu,
      });
    }
    const _nLayersTail = r.readU32();
    alternatives.push({
      id: `pa-${i + 1}`,
      name: paNames[i] ?? `Phương án ${i + 1}`,
      layers,
    });
  }

  return {
    projectInfo: {
      congTrinh,
      diaDiem,
      kySuThietKe,
      doiTuongTK: decodeDoiTuong(doiTuongTKCode),
      loaiTK: decodeLoaiTK(loaiTKCode),
    },
    roadScale: {
      loaiDuong: decodeLoaiDuong(loaiDuongCode),
      capDuong,
      soLanXe,
      gpcGiua: (gpcByte & 1) !== 0,
      gpcBen: (gpcByte & 2) !== 0,
      heSoLan_fL,
      vanTocTK_kmh,
      doTinCayTK,
      Kcd_vong,
      Kcd_truot,
      Kcd_keoUon,
    },
    vehicles,
    forecast: {
      khongCoSoLieuDieuTra: false,
      llNamTTDirect_trucNgDem: 0,
      thoiHanTK_nam,
      namTinhToan: decodeNamTT(namTTCode),
      quyLuatTangTruong_q,
      tlTrucQuyDoi_kN,
      taiTrongTrucTacDung: decodeAppliedAxle(tttdCode),
      duongKinhVetBanh_D_cm: D_cm || STANDARD_AXLE_PARAMS[tlTrucQuyDoi_kN].D_cm,
      apLucBanh_p_MPa: p_MPa || STANDARD_AXLE_PARAMS[tlTrucQuyDoi_kN].p_MPa,
    },
    subgrade: {
      xacDinhTheoDoAm: xdDoAm,
      loaiDat,
      doAmTuongDoi_a,
      doChatYeuCau_K,
      lanSoiSan,
      E0_MPa,
      phi_deg,
      C_MPa,
      flag2,
    },
    designParams: {
      loaiTangMat: decodeSurfaceGrade(loaiTMCode),
      Emin_MPa,
      Eyc_MPa,
      Ett_MPa,
    },
    alternatives,
    activeAlternativeId: alternatives[0]?.id ?? 'pa-1',
    storedNtk,
  };
}

export function serializeAdmProject(
  project: ProjectState,
  computedNtk?: number,
): Uint8Array {
  const w = new BinaryWriter();
  writeCommonHeader(w, new Uint8Array(9), SECTION_PROJECT);

  const alts = project.alternatives;
  w.writeU32(alts.length);
  for (const alt of alts) {
    w.writeTag4();
    w.writeU16String(alt.name);
  }

  // Project Info
  w.writeTag4();
  w.writeU16String(project.projectInfo.congTrinh);
  w.writeU16String(project.projectInfo.diaDiem);
  w.writeU16String(project.projectInfo.kySuThietKe);
  w.writeU8(encodeDoiTuong(project.projectInfo.doiTuongTK));
  w.writeU8(encodeLoaiTK(project.projectInfo.loaiTK));

  // Road Scale
  w.writeTag4();
  w.writeU8(encodeLoaiDuong(project.roadScale.loaiDuong));
  w.writeU16String(project.roadScale.capDuong);
  w.writeF64(project.roadScale.doTinCayTK);
  const gpcByte =
    (project.roadScale.gpcGiua ? 1 : 0) | (project.roadScale.gpcBen ? 2 : 0);
  w.writeU8(gpcByte);
  w.writeU8(0);
  w.writeU32(project.roadScale.soLanXe);
  w.writeU32(project.roadScale.vanTocTK_kmh);
  w.writeF64(project.roadScale.heSoLan_fL);
  w.writeF64(project.roadScale.Kcd_vong);
  w.writeF64(project.roadScale.Kcd_truot);
  w.writeF64(project.roadScale.Kcd_keoUon);

  // Fleet
  w.writeTag4();
  w.writeU32(project.vehicles.length);
  w.writeU32(3);
  w.writeU32(0);
  for (let i = 0; i < project.vehicles.length; i++) {
    const v = project.vehicles[i];
    w.writeU8(encodeWheelGroup(v.cumBanhTrucSau));
    if (i > 0) {
      w.writeF64(v.khoangCachTrucSau_m);
    }
    w.writeU32(Math.round(v.luuLuong_xeNgDem));
    w.writeU32(Math.round(v.soTrucSau));
    w.writeU16String(v.tenXe);
    w.writeF64(v.tlTrucSau_kN);
    w.writeF64(v.tlTrucTruoc_kN);
    w.writeU8(v.flag ?? 0);
  }
  w.writeU32(project.vehicles.length);
  w.writeF64(computedNtk ?? project.storedNtk ?? project.forecast.llNamTTDirect_trucNgDem ?? 0);
  w.writeU8(1);

  // Forecast
  w.writeTag4();
  w.writeU32(Math.round(project.forecast.thoiHanTK_nam));
  w.writeF64(project.forecast.quyLuatTangTruong_q);
  w.writeU8(encodeNamTT(project.forecast.namTinhToan));
  w.writeU8(encodeAppliedAxle(project.forecast.taiTrongTrucTacDung));
  w.writeU8(encodeStandardAxle(project.forecast.tlTrucQuyDoi_kN));
  w.writeF64(project.forecast.duongKinhVetBanh_D_cm);
  w.writeF64(project.forecast.apLucBanh_p_MPa);

  // Subgrade
  w.writeTag4();
  w.writeU8(project.subgrade.xacDinhTheoDoAm ? 1 : 0);
  w.writeU16String(project.subgrade.loaiDat);
  w.writeF64(project.subgrade.doAmTuongDoi_a);
  w.writeF64(project.subgrade.doChatYeuCau_K);
  w.writeU8(project.subgrade.lanSoiSan ? 1 : 0);
  w.writeF64(project.subgrade.phi_deg);
  w.writeU8(project.subgrade.flag2 ?? 0);
  w.writeF64(project.subgrade.E0_MPa);
  w.writeF64(project.subgrade.C_MPa);

  // Design params
  w.writeTag4();
  w.writeU8(encodeSurfaceGrade(project.designParams.loaiTangMat));
  w.writeF64(project.designParams.Emin_MPa);
  w.writeF64(project.designParams.Eyc_MPa);
  w.writeF64(project.designParams.Ett_MPa);

  // Alternatives
  for (const alt of alts) {
    w.writeTag4();
    w.writeU32(alt.layers.length);
    for (const layer of alt.layers) {
      w.writeU16String(layer.tenVatLieu);
      w.writeF64(layer.E_vong_30C);
      w.writeF64(layer.E_truot_60C);
      w.writeF64(layer.E_keoUon_10_15C);
      w.writeF64(layer.Rku_MPa);
      w.writeF64(layer.C_MPa);
      w.writeF64(layer.phi_deg);
      w.writeF64(layer.chieuDay_cm);
      w.writeU8(layer.isTangMat ? 1 : 0);
      w.writeU32(layer.sttTrongTang);
      w.writeU16String(layer.ghiChu);
    }
    w.writeU32(alt.layers.length);
  }

  return w.toUint8Array();
}

export function parseVatLieuDat(buffer: ArrayBuffer | Uint8Array): MaterialRecord[] {
  const r = new BinaryReader(buffer);
  validateHeaderAndTag(r, SECTION_VATLIEU);

  const count = r.readU32();
  const records: MaterialRecord[] = [];
  let currentGroup = '';

  for (let i = 0; i < count; i++) {
    r.expectTag4();
    const rawName = r.readU16String();
    const E_vong_30C = r.readF64();
    const E_truot_60C = r.readF64();
    const E_keoUon_10_15C = r.readF64();
    const Rku_MPa = r.readF64();
    const C_MPa = r.readF64();
    const phi_deg = r.readF64();
    const note = r.readU16String();

    const isGroupHeader = rawName.startsWith('(*)');
    if (isGroupHeader) {
      currentGroup = rawName.slice(3).trim();
    }

    records.push({
      index: i,
      isGroupHeader,
      group: currentGroup,
      name: rawName,
      E_vong_30C,
      E_truot_60C,
      E_keoUon_10_15C,
      Rku_MPa,
      C_MPa,
      phi_deg,
      note,
    });
  }

  return records;
}

export function serializeVatLieuDat(materials: MaterialRecord[]): Uint8Array {
  const w = new BinaryWriter();
  writeCommonHeader(w, HEADER_TAIL_VATLIEU, SECTION_VATLIEU);
  w.writeU32(materials.length);
  for (const m of materials) {
    w.writeTag4();
    const outName = m.isGroupHeader && !m.name.startsWith('(*)') ? `(*)${m.name}` : m.name;
    w.writeU16String(outName);
    w.writeF64(m.E_vong_30C);
    w.writeF64(m.E_truot_60C);
    w.writeF64(m.E_keoUon_10_15C);
    w.writeF64(m.Rku_MPa);
    w.writeF64(m.C_MPa);
    w.writeF64(m.phi_deg);
    w.writeU16String(m.note);
  }
  return w.toUint8Array();
}

export function parseProjectJson(jsonText: string): ProjectState {
  const parsed = JSON.parse(jsonText) as ProjectState;
  if (!parsed || !parsed.projectInfo || !parsed.roadScale || !Array.isArray(parsed.alternatives)) {
    throw new Error('File JSON dự án không hợp lệ.');
  }
  return parsed;
}

export function serializeProjectJson(project: ProjectState): string {
  return JSON.stringify(project, null, 2);
}
