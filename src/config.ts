import { readFileSync } from 'node:fs';

export interface TemplateRef { repo: string; path: string; ref: string }
export interface Target { repo: string; path?: string }
export interface Config { template: TemplateRef; targets: Target[]; files: string[] }

export const DEFAULT_FILES = ['AGENTS.md', 'RULES.md', 'CLAUDE.md', 'GEMINI.md'];

/** Loads and validates rules-sync.json. Throws with a readable message on bad input. */
export function loadConfig(file: string): Config {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`cannot read config ${file}: ${(e as Error).message}`);
  }
  const c = raw as Partial<Config>;
  const t = c.template as Partial<TemplateRef> | undefined;
  if (!t || typeof t.repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(t.repo)) throw new Error('config: template.repo must be "owner/name"');
  if (typeof t.ref !== 'string' || !t.ref) throw new Error('config: template.ref must pin a tag, branch or commit');
  if (!Array.isArray(c.targets) || c.targets.length === 0) throw new Error('config: targets must be a non-empty array');
  for (const tg of c.targets) {
    if (!tg || typeof tg.repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(tg.repo)) throw new Error(`config: bad target ${JSON.stringify(tg)}`);
  }
  const files = Array.isArray(c.files) && c.files.length ? c.files.map(String) : DEFAULT_FILES;
  return {
    template: { repo: t.repo, ref: t.ref, path: normDir(t.path ?? 'template/') },
    targets: c.targets.map((x) => ({ repo: x.repo, path: normDir(x.path ?? '') })),
    files,
  };
}

function normDir(p: string): string {
  const s = p.replace(/\\/g, '/').replace(/^\.?\/+/, '');
  return s && !s.endsWith('/') ? `${s}/` : s;
}
