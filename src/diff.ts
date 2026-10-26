import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** Unified diff of current -> desired for one file, via `git diff --no-index`, with a/ b/ paths. */
export function unifiedDiff(file: string, current: string | null, desired: string): string {
  const tmp = mkdtempSync(join(tmpdir(), 'rules-sync-'));
  try {
    const a = join(tmp, 'a', file);
    const b = join(tmp, 'b', file);
    mkdirSync(dirname(b), { recursive: true });
    writeFileSync(b, desired);
    const left = current === null ? '/dev/null' : a;
    if (current !== null) { mkdirSync(dirname(a), { recursive: true }); writeFileSync(a, current); }
    try {
      execFileSync('git', ['diff', '--no-index', '--no-color', left, b], { cwd: tmp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      return '';
    } catch (e) {
      const out = (e as { stdout?: string }).stdout ?? '';
      const abs = tmp.replace(/\\/g, '/').replace(/^\//, '');
      return out.split(`${abs}/a/`).join('').split(`${abs}/b/`).join('').split(`a/${abs}/a/`).join('a/').split(`b/${abs}/b/`).join('b/');
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
