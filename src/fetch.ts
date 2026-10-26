import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

function git(args: string[], cwd?: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/**
 * Returns a read-only checkout of repo at ref (default branch when ref is empty), cloning
 * with --depth 1 into the cache dir. A --local override is used as-is and never modified.
 */
export function checkout(repo: string, ref: string, cache: string, local: Record<string, string>): string {
  if (local[repo]) return local[repo];
  const dir = join(cache, repo.replace('/', '__') + (ref ? `@${ref.slice(0, 40)}` : ''));
  if (existsSync(join(dir, '.git'))) return dir;
  mkdirSync(dir, { recursive: true });
  const url = `https://github.com/${repo}.git`;
  git(['init', '-q'], dir);
  git(['remote', 'add', 'origin', url], dir);
  git(['fetch', '-q', '--depth', '1', 'origin', ref || 'HEAD'], dir);
  git(['checkout', '-q', 'FETCH_HEAD'], dir);
  return dir;
}

/** Lists files under root (posix relative paths), skipping .git and node_modules. */
export function listFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    if (!existsSync(d)) return;
    for (const name of readdirSync(d)) {
      if (name === '.git' || name === 'node_modules') continue;
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(root, p).split('\\').join('/'));
    }
  };
  walk(root);
  return out.sort();
}

/** Minimal glob: "*" matches within one path segment, "**" across segments. */
export function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*' && glob[i + 1] === '*') { re += '.*'; i++; if (glob[i + 1] === '/') i++; }
    else if (ch === '*') re += '[^/]*';
    else if (ch === '?') re += '[^/]';
    else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

/** Template files (relative to the template dir) selected by the config's file list. */
export function selectFiles(templateDir: string, patterns: string[]): string[] {
  const res = patterns.map(globToRegExp);
  return listFiles(templateDir).filter((f) => res.some((r) => r.test(f)));
}
