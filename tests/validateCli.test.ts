// CLI tests for scripts/validate-storyboard.ts (the script the validation hook runs).
// Requirements: 11.4
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');
const TSX = join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const SCRIPT = 'scripts/validate-storyboard.ts';
const VALID = 'tests/fixtures/valid.storyboard.json';
const INVALID = 'tests/fixtures/invalid.storyboard.json';
const TIMEOUT = 30_000;

function run(args: string[], input = '') {
  // Drop FILE so the script's env fallback cannot pick up a stray path.
  const env = { ...process.env };
  delete env.FILE;
  const result = spawnSync(TSX, [SCRIPT, ...args], {
    cwd: ROOT,
    input,
    encoding: 'utf8',
    env,
    timeout: TIMEOUT,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('validate-storyboard CLI', () => {
  it(
    'exits 0 and reports valid for the valid fixture',
    () => {
      const r = run([VALID]);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain(`${VALID}: valid`);
    },
    TIMEOUT,
  );

  it(
    'exits 1 with JSON-path error lines for the invalid fixture',
    () => {
      const r = run([INVALID]);
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/^\$\.sceneCount: /m);
      expect(r.stderr).toMatch(/^\$\.scenes\[\d+\]\S*: /m);
      expect(r.stdout).not.toContain('valid');
    },
    TIMEOUT,
  );

  it(
    'exits 1 for a malformed JSON file',
    () => {
      const dir = mkdtempSync(join(tmpdir(), 'scenebeat-cli-'));
      try {
        const file = join(dir, 'broken.storyboard.json');
        writeFileSync(file, '{ "version": "1.0", ');
        const r = run([file]);
        expect(r.status).toBe(1);
        expect(r.stderr).toMatch(/^\$: /m);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    TIMEOUT,
  );

  it(
    'reads the file path from hook stdin JSON',
    () => {
      const r = run([], JSON.stringify({ filePath: VALID }));
      expect(r.status).toBe(0);
      expect(r.stdout).toContain(`${VALID}: valid`);
    },
    TIMEOUT,
  );

  it(
    'exits 2 with usage when no path is given',
    () => {
      const r = run([], '');
      expect(r.status).toBe(2);
      expect(r.stderr).toContain('Usage');
    },
    TIMEOUT,
  );
});
