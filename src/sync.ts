import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Config, Target } from './config.js';
import { checkout, selectFiles } from './fetch.js';
import { merge } from './merge.js';

export type Status = 'in-sync' | 'drifted' | 'missing';
export interface FileResult { file: string; status: Status; current: string | null; desired: string; warnings: string[] }
export interface RepoResult { target: Target; dir: string; files: FileResult[] }
export interface Options { cache: string; local: Record<string, string> }

const norm = (s: string) => s.replace(/\r\n/g, '\n').replace(/\n+$/, '');

/** Computes the desired content of every selected file in every target and compares it. */
export function analyse(config: Config, opts: Options): { templateDir: string; repos: RepoResult[] } {
  const tRoot = checkout(config.template.repo, config.template.ref, opts.cache, opts.local);
  const templateDir = join(tRoot, config.template.path);
  if (!existsSync(templateDir)) throw new Error(`template path ${config.template.path} not found in ${config.template.repo}@${config.template.ref}`);
  const files = selectFiles(templateDir, config.files);
  const repos: RepoResult[] = config.targets.map((target) => {
    const root = checkout(target.repo, '', opts.cache, opts.local);
    const dir = join(root, target.path ?? '');
    const results = files.map((file): FileResult => {
      const tpl = readFileSync(join(templateDir, file), 'utf8');
      const p = join(dir, file);
      if (!existsSync(p)) return { file, status: 'missing', current: null, desired: tpl, warnings: [] };
      const current = readFileSync(p, 'utf8');
      const m = merge(tpl, current);
      const desired = m.text.endsWith('\n') || !tpl.endsWith('\n') ? m.text : `${m.text}\n`;
      return { file, status: norm(current) === norm(desired) ? 'in-sync' : 'drifted', current, desired, warnings: m.warnings };
    });
    return { target, dir, files: results };
  });
  return { templateDir, repos };
}

export function hasDrift(r: RepoResult): boolean {
  return r.files.some((f) => f.status !== 'in-sync');
}
