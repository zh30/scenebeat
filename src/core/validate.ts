import { TEMPLATES } from './types';
import type { SceneTemplate, ValidationError } from './types';

const MIN_DURATION_MS = 2000;
const MAX_DURATION_MS = 8000;

/** ISO 8601 date or date-time (calendar form), e.g. `2026-10-31T12:00:00.000Z`. */
const ISO_8601 =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** The `data` key required for each template. */
const DATA_KEY: Record<SceneTemplate, 'value' | 'keywords' | 'quote' | 'label'> = {
  'big-number': 'value',
  'keyword-highlight': 'keywords',
  quote: 'quote',
  timeline: 'label',
};

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(obj: PlainObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isTemplate(value: unknown): value is SceneTemplate {
  return typeof value === 'string' && (TEMPLATES as readonly string[]).includes(value);
}

function isIso8601(value: string): boolean {
  return ISO_8601.test(value) && !Number.isNaN(Date.parse(value));
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number' && !Number.isInteger(value)) return `non-integer number ${value}`;
  return typeof value;
}

/**
 * Checks a JSON value against the storyboard JSON structure.
 * Total: never throws. Returns an empty array when the value is valid.
 */
export function validateStoryboard(value: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  const add = (path: string, message: string): void => {
    errors.push({ path, message });
  };

  if (!isPlainObject(value)) {
    add('$', `Expected storyboard to be an object, got ${describe(value)}`);
    return errors;
  }

  // version
  if (!hasOwn(value, 'version')) {
    add('$.version', 'Missing required field "version"');
  } else if (typeof value.version !== 'string') {
    add('$.version', `Expected "version" to be a string, got ${describe(value.version)}`);
  }

  // createdAt
  if (!hasOwn(value, 'createdAt')) {
    add('$.createdAt', 'Missing required field "createdAt"');
  } else if (typeof value.createdAt !== 'string') {
    add('$.createdAt', `Expected "createdAt" to be a string, got ${describe(value.createdAt)}`);
  } else if (!isIso8601(value.createdAt)) {
    add('$.createdAt', `Expected "createdAt" to be an ISO 8601 timestamp, got "${value.createdAt}"`);
  }

  // sceneCount
  const sceneCountValid = hasOwn(value, 'sceneCount') && Number.isInteger(value.sceneCount);
  if (!hasOwn(value, 'sceneCount')) {
    add('$.sceneCount', 'Missing required field "sceneCount"');
  } else if (!sceneCountValid) {
    add('$.sceneCount', `Expected "sceneCount" to be an integer, got ${describe(value.sceneCount)}`);
  }

  // scenes
  if (!hasOwn(value, 'scenes')) {
    add('$.scenes', 'Missing required field "scenes"');
    return errors;
  }
  if (!Array.isArray(value.scenes)) {
    add('$.scenes', `Expected "scenes" to be an array, got ${describe(value.scenes)}`);
    return errors;
  }
  const scenes: unknown[] = value.scenes;

  // sceneCount vs scenes.length
  if (sceneCountValid && value.sceneCount !== scenes.length) {
    add(
      '$.sceneCount',
      `sceneCount ${String(value.sceneCount)} does not match scenes length ${scenes.length}`,
    );
  }

  let indexSequenceBroken = false;

  scenes.forEach((scene, i) => {
    const base = `$.scenes[${i}]`;
    if (!isPlainObject(scene)) {
      add(base, `Expected scene ${i} to be an object, got ${describe(scene)}`);
      return;
    }

    // index
    if (!hasOwn(scene, 'index')) {
      add(`${base}.index`, 'Missing required field "index"');
    } else if (!Number.isInteger(scene.index)) {
      add(`${base}.index`, `Expected "index" to be an integer, got ${describe(scene.index)}`);
    } else if (!indexSequenceBroken && scene.index !== i) {
      indexSequenceBroken = true;
      add(
        `${base}.index`,
        `Scene index out of sequence at position ${i}: expected ${i}, got ${String(scene.index)}`,
      );
    }

    // text
    if (!hasOwn(scene, 'text')) {
      add(`${base}.text`, 'Missing required field "text"');
    } else if (typeof scene.text !== 'string') {
      add(`${base}.text`, `Expected "text" to be a string, got ${describe(scene.text)}`);
    } else if (scene.text.length === 0) {
      add(`${base}.text`, `Scene ${i} "text" must be a non-empty string`);
    }

    // template
    let template: SceneTemplate | undefined;
    if (!hasOwn(scene, 'template')) {
      add(`${base}.template`, 'Missing required field "template"');
    } else if (typeof scene.template !== 'string') {
      add(`${base}.template`, `Expected "template" to be a string, got ${describe(scene.template)}`);
    } else if (!isTemplate(scene.template)) {
      add(
        `${base}.template`,
        `Scene ${i} has invalid template "${scene.template}"; expected one of ${TEMPLATES.join(', ')}`,
      );
    } else {
      template = scene.template;
    }

    // durationMs
    if (!hasOwn(scene, 'durationMs')) {
      add(`${base}.durationMs`, 'Missing required field "durationMs"');
    } else if (!Number.isInteger(scene.durationMs)) {
      add(
        `${base}.durationMs`,
        `Expected "durationMs" to be an integer, got ${describe(scene.durationMs)}`,
      );
    } else {
      const ms = scene.durationMs as number;
      if (ms < MIN_DURATION_MS || ms > MAX_DURATION_MS) {
        add(
          `${base}.durationMs`,
          `Scene ${i} durationMs ${ms} is outside ${MIN_DURATION_MS}-${MAX_DURATION_MS}`,
        );
      }
    }

    // data
    if (!hasOwn(scene, 'data')) {
      add(`${base}.data`, 'Missing required field "data"');
      return;
    }
    const data = scene.data;
    if (!isPlainObject(data)) {
      add(`${base}.data`, `Expected "data" to be an object, got ${describe(data)}`);
      return;
    }
    if (template === undefined) return; // cannot check template-specific keys

    const key = DATA_KEY[template];
    const keyPath = `${base}.data.${key}`;
    if (!hasOwn(data, key)) {
      add(keyPath, `Missing required field "${key}" for template "${template}"`);
      return;
    }
    const field = data[key];
    if (key === 'keywords') {
      if (!Array.isArray(field)) {
        add(keyPath, `Expected "keywords" to be an array of strings, got ${describe(field)}`);
        return;
      }
      if (field.length < 1 || field.length > 3) {
        add(keyPath, `Expected 1 to 3 keywords, got ${field.length}`);
      }
      field.forEach((kw: unknown, k) => {
        if (typeof kw !== 'string') {
          add(`${keyPath}[${k}]`, `Expected keyword to be a string, got ${describe(kw)}`);
        }
      });
    } else if (typeof field !== 'string') {
      add(keyPath, `Expected "${key}" to be a string, got ${describe(field)}`);
    }
  });

  return errors;
}
