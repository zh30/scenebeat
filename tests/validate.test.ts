import { describe, expect, it } from 'vitest';
import { validateStoryboard } from '../src/core/validate';

function validStoryboard(): Record<string, unknown> {
  return {
    version: '1.0',
    createdAt: '2026-10-31T12:00:00.000Z',
    sceneCount: 3,
    scenes: [
      {
        index: 0,
        text: 'Revenue grew 45% in 2025.',
        template: 'timeline',
        durationMs: 2750,
        data: { label: '2025' },
      },
      {
        index: 1,
        text: 'Costs fell by 3 million.',
        template: 'big-number',
        durationMs: 2250,
        data: { value: '3' },
      },
      {
        index: 2,
        text: 'Customers love the product.',
        template: 'keyword-highlight',
        durationMs: 2000,
        data: { keywords: ['Customers', 'product'] },
      },
    ],
  };
}

function scenes(sb: Record<string, unknown>): Record<string, unknown>[] {
  return sb.scenes as Record<string, unknown>[];
}

describe('validateStoryboard', () => {
  it('accepts a valid storyboard', () => {
    expect(validateStoryboard(validStoryboard())).toEqual([]);
  });

  it('reports a sceneCount mismatch naming both numbers (Req 8.2)', () => {
    const sb = validStoryboard();
    sb.sceneCount = 5;
    const errors = validateStoryboard(sb);
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe('$.sceneCount');
    expect(errors[0].message).toContain('5');
    expect(errors[0].message).toContain('3');
  });

  it('reports only the first out-of-sequence index (Req 8.3)', () => {
    const sb = validStoryboard();
    scenes(sb)[1].index = 2;
    scenes(sb)[2].index = 1;
    const errors = validateStoryboard(sb);
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe('$.scenes[1].index');
    expect(errors[0].message).toContain('position 1');
  });

  it('reports an invalid template naming the scene index and value (Req 8.4)', () => {
    const sb = validStoryboard();
    scenes(sb)[2].template = 'spinning-cube';
    const errors = validateStoryboard(sb);
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe('$.scenes[2].template');
    expect(errors[0].message).toContain('Scene 2');
    expect(errors[0].message).toContain('spinning-cube');
  });

  it('reports a missing field by JSON path (Req 8.5)', () => {
    const sb = validStoryboard();
    delete scenes(sb)[0].text;
    const errors = validateStoryboard(sb);
    expect(errors).toEqual([
      { path: '$.scenes[0].text', message: 'Missing required field "text"' },
    ]);
  });

  it('reports a mistyped root field by JSON path (Req 8.5)', () => {
    const sb = validStoryboard();
    sb.version = 1;
    const errors = validateStoryboard(sb);
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe('$.version');
  });

  it('reports an out-of-range durationMs naming the scene index (Req 8.6)', () => {
    const sb = validStoryboard();
    scenes(sb)[1].durationMs = 9000;
    const errors = validateStoryboard(sb);
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe('$.scenes[1].durationMs');
    expect(errors[0].message).toContain('Scene 1');
    expect(errors[0].message).toContain('9000');
  });

  it('accepts durationMs at the 2000 and 8000 boundaries', () => {
    const sb = validStoryboard();
    scenes(sb)[0].durationMs = 2000;
    scenes(sb)[1].durationMs = 8000;
    expect(validateStoryboard(sb)).toEqual([]);
  });
});

function validStoryboard11(): Record<string, unknown> {
  const sb = validStoryboard();
  sb.version = '1.1';
  scenes(sb).forEach((scene, i) => {
    scene.templateSource = i === 1 ? 'manual' : 'auto';
  });
  return sb;
}

describe('validateStoryboard: version and templateSource (edit-export)', () => {
  it('accepts a valid version 1.1 storyboard (Req 5.6)', () => {
    expect(validateStoryboard(validStoryboard11())).toEqual([]);
  });

  it('reports an unsupported version naming the value and skips templateSource checks (Req 5.5, 5.7)', () => {
    const sb = validStoryboard11();
    sb.version = '2.0';
    delete scenes(sb)[0].templateSource;
    expect(validateStoryboard(sb)).toEqual([
      { path: '$.version', message: 'Unsupported version "2.0"; expected "1.0" or "1.1"' },
    ]);
  });

  it('reports a missing templateSource on a 1.1 scene (Req 5.8)', () => {
    const sb = validStoryboard11();
    delete scenes(sb)[2].templateSource;
    expect(validateStoryboard(sb)).toEqual([
      { path: '$.scenes[2].templateSource', message: 'Missing required field "templateSource"' },
    ]);
  });

  it('reports an invalid string templateSource on a 1.1 scene (Req 5.8)', () => {
    const sb = validStoryboard11();
    scenes(sb)[1].templateSource = 'human';
    expect(validateStoryboard(sb)).toEqual([
      {
        path: '$.scenes[1].templateSource',
        message: 'Scene 1 has invalid templateSource "human"; expected "auto" or "manual"',
      },
    ]);
  });

  it('reports a non-string templateSource on a 1.1 scene by type (Req 5.8)', () => {
    const sb = validStoryboard11();
    scenes(sb)[0].templateSource = null;
    expect(validateStoryboard(sb)).toEqual([
      {
        path: '$.scenes[0].templateSource',
        message: 'Scene 0 has invalid templateSource null; expected "auto" or "manual"',
      },
    ]);
  });

  it('reports a templateSource on a 1.0 scene (Req 5.9)', () => {
    const sb = validStoryboard();
    scenes(sb)[1].templateSource = 'auto';
    expect(validateStoryboard(sb)).toEqual([
      { path: '$.scenes[1].templateSource', message: 'Field "templateSource" requires version "1.1"' },
    ]);
  });

  it('runs no templateSource checks when version is not a string', () => {
    const sb = validStoryboard11();
    sb.version = 11;
    scenes(sb)[0].templateSource = 'bogus';
    const errors = validateStoryboard(sb);
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe('$.version');
  });
});
