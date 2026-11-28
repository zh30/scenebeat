import { describe, expect, it } from 'vitest';
import { buildStoryboard } from '../src/core/buildStoryboard';
import { buildEditedStoryboard } from '../src/core/editedStoryboard';
import {
  applyOverrides,
  hasOverride,
  occurrenceRanks,
  overrideKey,
  reconcileOverrides,
  setEditedText,
  setManualTemplate,
} from '../src/core/overrides';
import type { SceneOverrides } from '../src/core/types';

const NOW = new Date('2026-10-31T12:00:00.000Z');

function editOk(...args: Parameters<typeof setEditedText>): SceneOverrides {
  const r = setEditedText(...args);
  if (!r.ok) throw new Error(r.error);
  return r.overrides;
}

describe('occurrence ranks', () => {
  it('gives duplicate sentences ranks 0, 1, 2', () => {
    const auto = buildStoryboard('Same line.\nSame line.\nSame line.', NOW);
    const texts = auto.scenes.map((s) => s.text);
    expect(texts).toEqual(['Same line.', 'Same line.', 'Same line.']);
    expect(occurrenceRanks(texts)).toEqual([0, 1, 2]);
  });

  it('counts each distinct text separately', () => {
    expect(occurrenceRanks(['a', 'b', 'a', 'b', 'a'])).toEqual([0, 0, 1, 1, 2]);
  });
});

describe('edits on duplicate sentences', () => {
  it('keeps an edit on the second duplicate after a sentence is inserted before the first', () => {
    const before = buildStoryboard('Same line.\nSame line.\nSame line.', NOW);
    const overrides = editOk({}, before.scenes[1], 1, 'Changed line.');

    const beforeEdited = applyOverrides(before.scenes, overrides).map((s) => s.text);
    expect(beforeEdited).toEqual(['Same line.', 'Changed line.', 'Same line.']);

    const after = buildStoryboard('Intro here.\nSame line.\nSame line.\nSame line.', NOW);
    const reconciled = reconcileOverrides(after.scenes, overrides);
    expect(reconciled).toEqual(overrides);

    const edited = buildEditedStoryboard(after, reconciled);
    expect(edited.scenes.map((s) => s.text)).toEqual([
      'Intro here.',
      'Same line.',
      'Changed line.',
      'Same line.',
    ]);
    expect(edited.scenes.map((s) => s.index)).toEqual([0, 1, 2, 3]);
  });

  it('drops an edit on a duplicate that no longer exists', () => {
    const before = buildStoryboard('Same line.\nSame line.', NOW);
    const overrides = editOk({}, before.scenes[1], 1, 'Changed line.');
    const after = buildStoryboard('Same line.', NOW);
    expect(reconcileOverrides(after.scenes, overrides)).toEqual({});
  });
});

describe('setEditedText with text equal to the Source_Text', () => {
  it('removes the override when it only had an edited text', () => {
    const auto = buildStoryboard('Hello world.', NOW).scenes[0];
    const edited = editOk({}, auto, 0, 'Goodbye world.');
    expect(hasOverride(edited, auto, 0)).toBe(true);

    const restored = editOk(edited, auto, 0, '  Hello world.\n');
    expect(restored).toEqual({});
    expect(hasOverride(restored, auto, 0)).toBe(false);
  });

  it('removes editedText but keeps a manual template', () => {
    const auto = buildStoryboard('Hello world.', NOW).scenes[0];
    const key = overrideKey(auto.text, 0);
    let ov = setManualTemplate({}, auto, 0, 'quote');
    ov = editOk(ov, auto, 0, 'Goodbye world.');
    expect(ov[key]).toEqual({
      sourceText: 'Hello world.',
      rank: 0,
      editedText: 'Goodbye world.',
      manualTemplate: 'quote',
    });

    ov = editOk(ov, auto, 0, 'Hello world.');
    expect(ov[key]).toEqual({ sourceText: 'Hello world.', rank: 0, manualTemplate: 'quote' });
    const [scene] = applyOverrides([auto], ov);
    expect(scene.text).toBe('Hello world.');
    expect(scene.template).toBe('quote');
    expect(scene.templateSource).toBe('manual');
  });
});
