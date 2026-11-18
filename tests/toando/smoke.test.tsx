import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import App from '../../src/toando/App';

describe('ToanDo-Web scaffold', () => {
  it('renders App root heading', () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    flushSync(() => {
      root.render(<App />);
    });
    expect(host.textContent).toContain('Áo đường mềm (TCCS 38:2022/TCĐBVN)');
    root.unmount();
  });
});
