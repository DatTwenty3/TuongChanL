import type { StdCode, TabId } from '../engine';

interface StandardBannerProps {
  activeStd: StdCode;
  activeTab: TabId;
  onSelectStd: (std: StdCode) => void;
  onSelectTab: (tab: TabId) => void;
}

const STANDARDS: ReadonlyArray<{ code: StdCode; title: string; desc: string }> = [
  {
    code: '39',
    title: 'TCCS 39:2022',
    desc: 'Mặt đường cứng — tấm bê tông xi măng (BTXM)',
  },
  {
    code: '38',
    title: 'TCCS 38:2022',
    desc: 'Mặt đường mềm — lý thuyết đa lớp đàn hồi (Odemark)',
  },
  {
    code: '37',
    title: 'TCCS 37:2022',
    desc: 'Mặt đường mềm — chỉ số kết cấu SN (AASHTO 1993)',
  },
];

const TCCS39_TABS: ReadonlyArray<{ tab: TabId; label: string }> = [
  { tab: 'rigid', label: 'Mặt đường cứng · TCCS 39' },
  { tab: 'drain', label: 'Thoát nước · Điều 7' },
  { tab: 'joint', label: 'Khe nối & thanh truyền lực · Điều 6' },
];

export function StandardBanner({ activeStd, activeTab, onSelectStd, onSelectTab }: StandardBannerProps) {
  return (
    <>
      <nav className="stdnav" id="stdNav">
        <div className="stdnav-inner">
          <div className="stdnav-eyebrow">Chọn tiêu chuẩn thiết kế</div>
          <div className="stdnav-btns">
            {STANDARDS.map((s) => (
              <button
                key={s.code}
                className={`stdbtn${activeStd === s.code ? ' active' : ''}`}
                data-std={s.code}
                type="button"
                onClick={() => onSelectStd(s.code)}
              >
                <span className="sn">{s.title}</span>
                <span className="sd">{s.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      <nav className="tabs" id="subTabs" style={{ display: activeStd === '39' ? 'flex' : 'none' }}>
        {TCCS39_TABS.map((t) => (
          <button
            key={t.tab}
            className={`tab${activeTab === t.tab ? ' active' : ''}`}
            data-tab={t.tab}
            type="button"
            onClick={() => onSelectTab(t.tab)}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </>
  );
}
