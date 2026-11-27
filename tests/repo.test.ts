import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(__dirname, '..');
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');

/** Remove // and /* *\/ comments outside of strings, plus trailing commas. */
function stripJsonComments(text: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += next ?? '';
        i++;
      } else if (ch === '"') {
        inString = false;
      }
    } else if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (ch === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i++;
    } else {
      out += ch;
    }
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

function gitUsable(): boolean {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: root, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/** True if git ignores the path; falls back to simple .gitignore line matching. */
function isIgnored(rel: string): boolean {
  if (gitUsable()) {
    const result = spawnSync('git', ['check-ignore', '-q', '--no-index', rel], { cwd: root });
    if (result.status === 0) return true;
    if (result.status === 1) return false;
    throw new Error(`git check-ignore failed for ${rel}: ${String(result.stderr)}`);
  }
  const lines = read('.gitignore')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'));
  const top = rel.split('/')[0];
  return lines.some((l) => l.replace(/^\//, '').replace(/\/$/, '') === top);
}

interface HookFile {
  version: string;
  hooks: Array<{
    name: string;
    trigger: string;
    matcher: string;
    action: { type: string; command: string };
  }>;
}

describe('repository smoke tests', () => {
  it('tsconfig.json enables strict mode (11.1)', () => {
    const tsconfig = JSON.parse(stripJsonComments(read('tsconfig.json')));
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  it.each(['product', 'tech', 'structure'])(
    'steering file %s.md exists with inclusion: always (11.2)',
    (name) => {
      const content = read(`.kiro/steering/${name}.md`);
      const frontMatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
      expect(frontMatter).not.toBeNull();
      expect(frontMatter![1]).toMatch(/^inclusion:\s*always\s*$/m);
    },
  );

  describe('validation hook (11.3, 11.4)', () => {
    const hookFile = JSON.parse(read('.kiro/hooks/validate-storyboard.json')) as HookFile;
    const hook = hookFile.hooks[0];

    it('is a single PostFileSave command hook running the validator CLI', () => {
      expect(hookFile.version).toBe('v1');
      expect(hookFile.hooks).toHaveLength(1);
      expect(hook.trigger).toBe('PostFileSave');
      expect(hook.action.type).toBe('command');
      expect(hook.action.command).toContain('scripts/validate-storyboard.ts');
      expect(existsSync(join(root, 'scripts/validate-storyboard.ts'))).toBe(true);
    });

    it('matcher selects storyboard files only', () => {
      const re = new RegExp(hook.matcher);
      expect(re.test('x.storyboard.json')).toBe(true);
      expect(re.test('/work/out/x.storyboard.json')).toBe(true);
      expect(re.test('scenebeat-storyboard-20260101-000000.json')).toBe(true);
      expect(re.test('/home/u/Downloads/scenebeat-storyboard-20260101-000000.json')).toBe(true);
      expect(re.test('package.json')).toBe(false);
      expect(re.test('tsconfig.json')).toBe(false);
    });
  });

  it('LICENSE is the MIT license (11.5)', () => {
    const license = read('LICENSE');
    expect(license).toMatch(/^MIT License/);
    expect(license).toContain('Permission is hereby granted, free of charge');
  });

  it('README.md covers features, prerequisites, and pnpm commands (11.6)', () => {
    const readme = read('README.md');
    expect(readme).toMatch(/^##\s+Features/m);
    expect(readme).toMatch(/^##\s+Prerequisites/m);
    expect(readme).toMatch(/Node\.js/);
    for (const cmd of ['pnpm install', 'pnpm dev', 'pnpm build', 'pnpm test']) {
      expect(readme).toContain(cmd);
    }
  });

  it('.gitignore ignores node_modules and dist but not .kiro (11.7)', () => {
    expect(existsSync(join(root, '.gitignore'))).toBe(true);
    // Paths inside the directories, so directory-only patterns (`dist/`) match
    // even when the directory does not exist yet. The node_modules probe is a
    // direct child because pnpm symlinks packages and git refuses paths beyond a link.
    expect(isIgnored('node_modules/.ignore-probe')).toBe(true);
    expect(isIgnored('dist/index.html')).toBe(true);
    expect(isIgnored('.kiro/steering/product.md')).toBe(false);
    expect(isIgnored('.kiro/hooks/validate-storyboard.json')).toBe(false);
  });
});
