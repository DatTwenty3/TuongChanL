import { useEffect, useRef, useState } from 'react';
import { BrandMark, Icon } from '../../components/Icon';
import { ModuleSwitch } from '../../shared/ModuleSwitch';
import type { ThemeMode } from '../../shared/theme';
import type { TabId } from '../engine';

interface HeaderProps {
  activeTab: TabId;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onExportWord: () => void;
  onExportExcel: () => void;
}

const TCVN_DOCS = [
  {
    code: 'TCCS 37:2022/TCĐBVN',
    desc: 'Áo đường mềm — chỉ số kết cấu SN · 196 trang',
    href: 'https://kcad.netlify.app/docs/TCCS_37_2022_AoDuongMem_ChiSoKetCau.pdf',
  },
  {
    code: 'TCCS 38:2022/TCĐBVN',
    desc: 'Áo đường mềm · 73 trang',
    href: 'https://kcad.netlify.app/docs/TCCS_38_2022_AoDuongMem.pdf',
  },
  {
    code: 'TCCS 39:2022/TCĐBVN',
    desc: 'Mặt đường BTXM có khe nối · 48 trang',
    href: 'https://kcad.netlify.app/docs/TCCS_39_2022_MatDuongBTXM.pdf',
  },
];

export function Header({ activeTab, theme, onToggleTheme, onExportWord, onExportExcel }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuOpen && wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const showExports = activeTab === 'rigid' || activeTab === 'flex' || activeTab === 'sn37';

  return (
    <header className="hdr">
      <div className="brand">
        <span className="logo" aria-hidden="true">
          <BrandMark />
        </span>
        <div>
          <b>
            LEDAT-<span className="wm-g">BIM</span>
          </b>
          <small>Mặt đường · TCCS 37·38·39</small>
        </div>
      </div>
      <ModuleSwitch current="pavement" />
      <div className="sp" />
      <div className="btns">
        <div className="tcvnwrap" id="tcvnWrap" ref={wrapRef}>
          <button
            className="btn"
            id="btnTCVN"
            type="button"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
          >
            <Icon name="file" size={15} />
            Các TCVN liên quan
          </button>
          <div className="tcvnmenu" id="tcvnMenu" hidden={!menuOpen}>
            <div className="tcvnhead">Văn bản tiêu chuẩn gốc (PDF)</div>
            {TCVN_DOCS.map((doc) => (
              <div className="tcvnrow" key={doc.code}>
                <div className="tcvninfo">
                  <b>{doc.code}</b>
                  <span>{doc.desc}</span>
                </div>
                <div className="tcvnact">
                  <a href={doc.href} target="_blank" rel="noopener noreferrer">
                    Mở
                  </a>
                  <a href={doc.href} download>
                    Tải về
                  </a>
                </div>
              </div>
            ))}
            <div className="tcvnfoot">File đã nén để tải nhanh hơn, vẫn giữ đầy đủ nội dung văn bản gốc.</div>
          </div>
        </div>
        <span id="exportBtns" style={{ display: showExports ? 'inline-flex' : 'none', gap: '8px', flexWrap: 'wrap', maxWidth: '100%' }}>
          <button className="btn" id="btnWord" type="button" onClick={onExportWord}>
            <Icon name="file" size={15} />
            Xuất thuyết minh (Word)
          </button>
          <button className="btn primary" id="btnXls" type="button" onClick={onExportExcel}>
            <Icon name="table" size={15} />
            Xuất Excel (link công thức)
          </button>
        </span>
        <button
          id="bTheme"
          className="ibtn"
          type="button"
          aria-pressed={theme === 'dark'}
          aria-label="Đổi giao diện sáng / tối"
          title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
          onClick={onToggleTheme}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </div>
    </header>
  );
}
