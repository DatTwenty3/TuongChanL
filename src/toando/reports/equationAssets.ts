import img_Check from './assets/equations/img_Check_Picture_Data.png';
import img_Cross from './assets/equations/img_Cross_Picture_Data.png';
import img_CT_Etb from './assets/equations/img_CT_Etb_Picture_Data.png';
import img_CT_Htb from './assets/equations/img_CT_Htb_Picture_Data.png';
import img_CT_k from './assets/equations/img_CT_k_Picture_Data.png';
import img_CT_t from './assets/equations/img_CT_t_Picture_Data.png';
import img_Ctt from './assets/equations/img_Ctt_Picture_Data.png';
import img_Ctt_alone from './assets/equations/img_Ctt_alone_Picture_Data.png';
import img_Ctt_Kcd_tr from './assets/equations/img_Ctt_Kcd_tr_Picture_Data.png';
import img_DK_KeoUon from './assets/equations/img_DK_KeoUon_Picture_Data.png';
import img_DK_Truot from './assets/equations/img_DK_Truot_Picture_Data.png';
import img_DK_Vong from './assets/equations/img_DK_Vong_Picture_Data.png';
import img_E1 from './assets/equations/img_E1_Picture_Data.png';
import img_E1_E2 from './assets/equations/img_E1_E2_Picture_Data.png';
import img_E1_Echm from './assets/equations/img_E1_Echm_Picture_Data.png';
import img_E2 from './assets/equations/img_E2_Picture_Data.png';
import img_E2_E3 from './assets/equations/img_E2_E3_Picture_Data.png';
import img_E3 from './assets/equations/img_E3_Picture_Data.png';
import img_Ech_F from './assets/equations/img_Ech_F_Picture_Data.png';
import img_Echm from './assets/equations/img_Echm_Picture_Data.png';
import img_Echm_E1 from './assets/equations/img_Echm_E1_Picture_Data.png';
import img_Eo_E1 from './assets/equations/img_Eo_E1_Picture_Data.png';
import img_Ephay_tb from './assets/equations/img_Ephay_tb_Picture_Data.png';
import img_Etb from './assets/equations/img_Etb_Picture_Data.png';
import img_Eyc from './assets/equations/img_Eyc_Picture_Data.png';
import img_H_D from './assets/equations/img_H_D_Picture_Data.png';
import img_k1 from './assets/equations/img_k1_Picture_Data.png';
import img_k2 from './assets/equations/img_k2_Picture_Data.png';
import img_k3 from './assets/equations/img_k3_Picture_Data.png';
import img_kb from './assets/equations/img_kb_Picture_Data.png';
import img_Kcd_dv from './assets/equations/img_Kcd_dv_Picture_Data.png';
import img_Kcd_dv_Eyc from './assets/equations/img_Kcd_dv_Eyc_Picture_Data.png';
import img_Kcd_ku from './assets/equations/img_Kcd_ku_Picture_Data.png';
import img_Rku_Kcd_ku from './assets/equations/img_Rku_Kcd_ku_Picture_Data.png';
import img_Rtt_ku from './assets/equations/img_Rtt_ku_Picture_Data.png';
import img_Sigma_ku from './assets/equations/img_Sigma_ku_Picture_Data.png';
import img_Sigma_Ku_alone from './assets/equations/img_Sigma_Ku__Picture_Data.png';
import img_SuyRa from './assets/equations/img_SuyRa_Picture_Data.png';
import img_Tav from './assets/equations/img_Tav_Picture_Data.png';
import img_Tax from './assets/equations/img_Tax_Picture_Data.png';
import img_Tax_p from './assets/equations/img_Tax_p_Picture_Data.png';
import img_Tax_Tav from './assets/equations/img_Tax_Tav_Picture_Data.png';

export const EQUATION_ASSETS = {
  check: { src: img_Check, alt: 'Đạt', width: 48, height: 48 },
  cross: { src: img_Cross, alt: 'Không đạt', width: 48, height: 48 },
  ctEtb: { src: img_CT_Etb, alt: "E'tb = E1 * ((1 + k * t^(1/3)) / (1 + k))^3", width: 117, height: 52 },
  ctHtb: { src: img_CT_Htb, alt: 'Htb = h1 + h2', width: 79, height: 23 },
  ctK: { src: img_CT_k, alt: 'k = h2 / h1', width: 49, height: 44 },
  ctT: { src: img_CT_t, alt: 't = E2 / E1', width: 43, height: 43 },
  ctt: { src: img_Ctt, alt: 'Ctt = C * k1 * k2 * k3', width: 109, height: 18 },
  cttAlone: { src: img_Ctt_alone, alt: 'Ctt', width: 20, height: 18 },
  cttKcdTr: { src: img_Ctt_Kcd_tr, alt: 'Ctt / Kcd^tr', width: 24, height: 39 },
  dkKeoUon: { src: img_DK_KeoUon, alt: 'σku ≤ Rtt^ku / Kcd^ku', width: 75, height: 48 },
  dkTruot: { src: img_DK_Truot, alt: 'τax + τav ≤ Ctt / Kcd^tr', width: 98, height: 41 },
  dkVong: { src: img_DK_Vong, alt: 'Ech ≥ Kcd^đv * Eyc', width: 102, height: 22 },
  e1: { src: img_E1, alt: 'E1', width: 20, height: 18 },
  e1E2: { src: img_E1_E2, alt: 'E1 / E2', width: 25, height: 43 },
  e1Echm: { src: img_E1_Echm, alt: 'E1 / Ech.m', width: 37, height: 39 },
  e2: { src: img_E2, alt: 'E2', width: 20, height: 18 },
  e2E3: { src: img_E2_E3, alt: 'E2 / E3', width: 25, height: 43 },
  e3: { src: img_E3, alt: 'E3', width: 20, height: 18 },
  echF: { src: img_Ech_F, alt: 'Ech.m (Công thức (E.1), Phụ lục E)', width: 260, height: 88 },
  echm: { src: img_Echm, alt: 'Ech.m', width: 34, height: 18 },
  echmE1: { src: img_Echm_E1, alt: 'Ech.m / E1', width: 37, height: 39 },
  eoE1: { src: img_Eo_E1, alt: 'E0 / E1', width: 23, height: 41 },
  ephayTb: { src: img_Ephay_tb, alt: "E'tb", width: 22, height: 27 },
  etb: { src: img_Etb, alt: "Etb^đc = β * E'tb", width: 72, height: 25 },
  eyc: { src: img_Eyc, alt: 'Eyc', width: 22, height: 20 },
  hD: { src: img_H_D, alt: 'H / D', width: 17, height: 33 },
  k1: { src: img_k1, alt: 'k1', width: 22, height: 18 },
  k2: { src: img_k2, alt: 'k2', width: 22, height: 18 },
  k3: { src: img_k3, alt: 'k3', width: 22, height: 18 },
  kb: { src: img_kb, alt: 'kb', width: 22, height: 18 },
  kcdDv: { src: img_Kcd_dv, alt: 'Kcd^đv', width: 28, height: 27 },
  kcdDvEyc: { src: img_Kcd_dv_Eyc, alt: 'Kcd^đv * Eyc', width: 56, height: 25 },
  kcdKu: { src: img_Kcd_ku, alt: 'Kcd^ku', width: 26, height: 23 },
  rkuKcdKu: { src: img_Rku_Kcd_ku, alt: 'Rtt^ku / Kcd^ku', width: 31, height: 49 },
  rttKu: { src: img_Rtt_ku, alt: 'Rtt^ku = k1 * k2 * Rku', width: 93, height: 27 },
  sigmaKu: { src: img_Sigma_ku, alt: 'σku = σ̄ku * p * kb', width: 122, height: 18 },
  sigmaKuAlone: { src: img_Sigma_Ku_alone, alt: 'σku', width: 29, height: 18 },
  suyRa: { src: img_SuyRa, alt: '⇒', width: 22, height: 16 },
  tav: { src: img_Tav, alt: 'τav', width: 22, height: 18 },
  tax: { src: img_Tax, alt: 'τax', width: 22, height: 18 },
  taxP: { src: img_Tax_p, alt: 'τax / p', width: 24, height: 34 },
  taxTav: { src: img_Tax_Tav, alt: 'τax + τav', width: 48, height: 18 },
} as const;

export type EquationAssetKey = keyof typeof EQUATION_ASSETS;
