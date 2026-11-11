import { describe, expect, it } from 'vitest';
import type { CalcConfig, ProjectFileEnvelope } from '../src/types/project';

describe('TuongChanL Web App scaffold contracts', () => {
  it('supports .tcl.json envelope typing', () => {
    const sample: ProjectFileEnvelope = {
      app: 'tuong-chan-L',
      v: 1,
      p: {
        tpl: 'B',
        type: 'canti',
        H: 500,
      },
    };
    expect(sample.app).toBe('tuong-chan-L');
    expect(sample.v).toBe(1);
    expect(sample.p.tpl).toBe('B');
  });

  it('captures full CalcConfig keys cleanly', () => {
    const partialCheck: Partial<CalcConfig> = {
      gs: 18,
      soil: 'r',
      ift: 'n',
      wMode: 'hs',
      feBasis: 'hand',
      femMesh: 'n',
      dec: '.',
    };
    expect(partialCheck.dec).toBe('.');
  });
});
