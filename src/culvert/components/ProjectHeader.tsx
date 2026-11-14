import type { ProjectMetadata } from '../types/project';

export const DEFAULT_PROJECT_METADATA: ProjectMetadata = {
  pj1: '',
  pj2: '',
  pj3: '',
  pj4: '',
  pj5: '',
  pj6: 'BẢNG TÍNH TOÁN KẾT CẤU CẦU',
};

export interface ProjectHeaderProps {
  metadata: ProjectMetadata;
  onChange: (field: keyof ProjectMetadata, value: string) => void;
}

export function ProjectHeader({ metadata, onChange }: ProjectHeaderProps) {
  return (
    <div className="proj">
      <p data-fmt="DỰ ÁN: {v}">
        <span>DỰ ÁN:</span>{' '}
        <input
          className="pj"
          id="pj1"
          placeholder="Nhập tên dự án"
          value={metadata.pj1}
          onChange={(e) => onChange('pj1', e.target.value)}
        />
      </p>
      <p data-fmt="{v}">
        <span>ĐỊA ĐIỂM:</span>{' '}
        <input
          className="pj"
          id="pj2"
          placeholder="Ví dụ: Xã ..., Tỉnh ..."
          value={metadata.pj2}
          onChange={(e) => onChange('pj2', e.target.value)}
        />
      </p>
      <p data-fmt="BƯỚC: {v}">
        <span>BƯỚC:</span>{' '}
        <input
          className="pj"
          id="pj3"
          placeholder="Ví dụ: Lập báo cáo kinh tế - kỹ thuật"
          value={metadata.pj3}
          onChange={(e) => onChange('pj3', e.target.value)}
        />
      </p>
      <p data-fmt="{v}">
        <span>TÊN BẢNG TÍNH:</span>{' '}
        <input
          className="pj"
          id="pj6"
          value={metadata.pj6}
          onChange={(e) => onChange('pj6', e.target.value)}
        />
      </p>
      <p data-fmt="HẠNG MỤC: {v}">
        <span>HẠNG MỤC:</span>{' '}
        <input
          className="pj"
          id="pj4"
          placeholder="Ví dụ: Kết cấu phần dưới - trụ T2"
          value={metadata.pj4}
          onChange={(e) => onChange('pj4', e.target.value)}
        />
      </p>
      <p className="sig">
        <span>NGƯỜI TÍNH:</span>{' '}
        <input
          className="pj"
          id="pj5"
          placeholder="Họ tên"
          value={metadata.pj5}
          onChange={(e) => onChange('pj5', e.target.value)}
        />
      </p>
    </div>
  );
}
