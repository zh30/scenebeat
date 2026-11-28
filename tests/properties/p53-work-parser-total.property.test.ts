// Feature: scenebeat-pwa, Property 53: Work parser is total and its output is valid.
// For any string, including arbitrary text, arbitrary JSON values, and mutated
// serializations of valid Saved_Work, `parseWork` returns without throwing; it
// returns { ok: false } whenever the value is not a JSON object,
// `version !== 1`, or `transcript` is not a string; and whenever it returns
// { ok: true, work }, every field of `work` satisfies the constraints of
// Requirements 12.1 and 12.2.
// **Validates: Requirements 12.5, 12.6, 12.9, 12.10**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseWork, serializeWork } from '../../src/core/savedWork';
import { ASPECT_RATIOS } from '../../src/core/aspectRatio';
import { overrideKey } from '../../src/core/overrides';
import { TEMPLATES } from '../../src/core/types';
import { invalidOverrideEntryArb, objectWithEntries, savedWorkArb } from './arbitraries';

const TOP_KEYS = ['version', 'transcript', 'overrides', 'aspectRatio', 'exportFormat', 'subtitleFormat'];
const RATIO_IDS: readonly string[] = ASPECT_RATIOS.map((r) => r.id);
const EXPORT_FORMATS = ['video', 'subtitles', 'storyboard-json'];
const SUBTITLE_FORMATS = ['srt', 'vtt'];
const OVERRIDE_KEYS = ['sourceText', 'rank', 'editedText', 'manualTemplate'];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Independent oracle for "must be rejected" (Requirements 12.5, 12.6). */
function mustReject(raw: string): boolean {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return true;
  }
  if (!isRecord(v)) return true;
  if (!Object.prototype.hasOwnProperty.call(v, 'version') || v.version !== 1) return true;
  if (!Object.prototype.hasOwnProperty.call(v, 'transcript') || typeof v.transcript !== 'string') return true;
  return false;
}

/** Every field satisfies Requirements 12.1 and 12.2. */
function expectValidWork(work: unknown): void {
  expect(isRecord(work)).toBe(true);
  const w = work as Record<string, unknown>;
  expect(Object.keys(w).sort()).toEqual(TOP_KEYS.filter((k) => k !== 'version').sort());
  expect(typeof w.transcript).toBe('string');
  expect(RATIO_IDS).toContain(w.aspectRatio);
  expect(EXPORT_FORMATS).toContain(w.exportFormat);
  expect(SUBTITLE_FORMATS).toContain(w.subtitleFormat);

  expect(isRecord(w.overrides)).toBe(true);
  expect(Object.getPrototypeOf(w.overrides)).toBe(Object.prototype);
  const overrides = w.overrides as Record<string, unknown>;
  for (const key of Object.keys(overrides)) {
    const e = overrides[key];
    expect(isRecord(e)).toBe(true);
    const o = e as Record<string, unknown>;
    for (const k of Object.keys(o)) expect(OVERRIDE_KEYS).toContain(k);
    expect(typeof o.sourceText).toBe('string');
    expect(Number.isInteger(o.rank) && (o.rank as number) >= 0).toBe(true);
    expect(key).toBe(overrideKey(o.sourceText as string, o.rank as number));
    if ('editedText' in o) {
      expect(typeof o.editedText).toBe('string');
      expect(o.editedText).not.toBe('');
    }
    if ('manualTemplate' in o) expect(TEMPLATES as readonly unknown[]).toContain(o.manualTemplate);
    expect('editedText' in o || 'manualTemplate' in o).toBe(true);
  }
}

/** A JSON-level mutation applied to a serialized valid Saved_Work. */
type Mutation =
  | { kind: 'set-top'; key: string; value: unknown }
  | { kind: 'delete-top'; key: string }
  | { kind: 'add-override'; key: string; value: unknown }
  | { kind: 'mutate-override'; index: number; field: string; value: unknown }
  | { kind: 'replace-root'; value: unknown };

const topKeyArb = fc.oneof(fc.constantFrom(...TOP_KEYS, '__proto__'), fc.string({ maxLength: 8 }));

const mutationArb: fc.Arbitrary<Mutation> = fc.oneof(
  fc.record({ kind: fc.constant('set-top' as const), key: topKeyArb, value: fc.jsonValue() }),
  fc.record({ kind: fc.constant('delete-top' as const), key: topKeyArb }),
  fc.oneof(
    invalidOverrideEntryArb.map((e) => ({ kind: 'add-override' as const, key: e.key, value: e.entry })),
    fc.record({
      kind: fc.constant('add-override' as const),
      key: fc.oneof(fc.string({ maxLength: 10 }), fc.constant('__proto__')),
      value: fc.jsonValue(),
    }),
  ),
  fc.record({
    kind: fc.constant('mutate-override' as const),
    index: fc.nat(),
    field: fc.constantFrom(...OVERRIDE_KEYS, '__proto__', 'extra'),
    value: fc.oneof(fc.jsonValue(), fc.constant(undefined)),
  }),
  fc.record({ kind: fc.constant('replace-root' as const), value: fc.jsonValue() }),
);

function setOwn(obj: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(obj, key, { value, enumerable: true, writable: true, configurable: true });
}

function applyMutations(serialized: string, mutations: Mutation[]): string {
  let root: unknown = JSON.parse(serialized);
  for (const m of mutations) {
    if (m.kind === 'replace-root') {
      root = m.value;
      continue;
    }
    if (!isRecord(root)) continue;
    if (m.kind === 'set-top') setOwn(root, m.key, m.value);
    else if (m.kind === 'delete-top') delete root[m.key];
    else {
      const ov = root.overrides;
      if (!isRecord(ov)) continue;
      if (m.kind === 'add-override') {
        root.overrides = objectWithEntries([...Object.entries(ov), [m.key, m.value]]);
      } else {
        const keys = Object.keys(ov);
        if (keys.length === 0) continue;
        const entry = ov[keys[m.index % keys.length]];
        if (!isRecord(entry)) continue;
        if (m.value === undefined) delete entry[m.field];
        else setOwn(entry, m.field, m.value);
      }
    }
  }
  return JSON.stringify(root) ?? 'undefined';
}

/** Text-level mutation: delete or insert characters at a position. */
const textMutationArb = fc.record({
  pos: fc.nat(),
  deleteCount: fc.nat({ max: 5 }),
  insert: fc.oneof(fc.constantFrom('', '"', '{', '}', ',', ':', '\\', '[', ']', 'null', '1'), fc.string({ maxLength: 4 })),
});

const inputArb: fc.Arbitrary<string> = fc.oneof(
  fc.string({ maxLength: 200 }),
  fc.string({ unit: 'grapheme', maxLength: 100 }),
  fc.jsonValue().map((v) => JSON.stringify(v) ?? 'null'),
  fc
    .tuple(savedWorkArb, fc.array(mutationArb, { minLength: 1, maxLength: 4 }))
    .map(([w, ms]) => applyMutations(serializeWork(w), ms)),
  fc.tuple(savedWorkArb, textMutationArb).map(([w, t]) => {
    const s = serializeWork(w);
    const p = t.pos % (s.length + 1);
    return s.slice(0, p) + t.insert + s.slice(p + t.deleteCount);
  }),
);

describe('Property 53: Work parser is total and its output is valid', () => {
  it('never throws, rejects non-objects / wrong version / non-string transcript, and returns valid work', () => {
    fc.assert(
      fc.property(inputArb, (raw) => {
        let result: ReturnType<typeof parseWork> | undefined;
        expect(() => {
          result = parseWork(raw);
        }).not.toThrow();
        expect(result).toBeDefined();
        const r = result!;
        if (mustReject(raw)) {
          expect(r).toEqual({ ok: false });
        } else {
          expect(r.ok).toBe(true);
        }
        if (r.ok) expectValidWork(r.work);
        // Parsing must never pollute Object.prototype.
        expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'sourceText')).toBe(false);
      }),
      { numRuns: 300 },
    );
  });
});
