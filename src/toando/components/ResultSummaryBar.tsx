import React from 'react';

export interface ResultSummaryItem {
  label: string;
  /** Giá trị ngắn gọn, ví dụ "3,892 ≤ 4,500 MPa". */
  value?: string;
  /** true = đạt, false = không đạt, null/undefined = chưa áp dụng / tham khảo. */
  passed?: boolean | null;
}

/**
 * Thanh tóm tắt kết quả kiểm toán đặt ở ĐẦU trang kết quả (dính khi cuộn) để người dùng thấy kết luận
 * ngay, không phải cuộn xuống cuối báo cáo.
 */
export function ResultSummaryBar({
  title,
  passed,
  items,
  note,
  testId = 'result-summary',
}: {
  title: string;
  passed: boolean;
  items: ResultSummaryItem[];
  note?: string;
  testId?: string;
}): React.ReactElement {
  return (
    <div
      className={`adm-summary-bar ${passed ? 'ok' : 'bad'}`}
      data-testid={testId}
      data-passed={passed ? 'true' : 'false'}
      role="status"
    >
      <div className="adm-summary-main">
        <span className="adm-summary-badge" aria-hidden="true">
          {passed ? '✓' : '✗'}
        </span>
        <div className="adm-summary-text">
          <strong>{passed ? 'ĐẠT' : 'KHÔNG ĐẠT'}</strong>
          <span>{title}</span>
        </div>
      </div>
      <ul className="adm-summary-items">
        {items.map((it) => (
          <li
            key={it.label}
            className={it.passed === true ? 'ok' : it.passed === false ? 'bad' : 'na'}
            title={it.value ? `${it.label}: ${it.value}` : it.label}
          >
            <span className="adm-summary-mark" aria-hidden="true">
              {it.passed === true ? '✓' : it.passed === false ? '✗' : '•'}
            </span>
            <span className="adm-summary-label">{it.label}</span>
            {it.value ? <span className="adm-summary-value">{it.value}</span> : null}
          </li>
        ))}
      </ul>
      {note ? <div className="adm-summary-note">{note}</div> : null}
    </div>
  );
}
