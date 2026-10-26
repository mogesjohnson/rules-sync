#!/usr/bin/env node
import { loadConfig } from './config.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyse, hasDrift } from './sync.js';
import { unifiedDiff } from './diff.js';
import { applyPr, planPr } from './prs.js';

export interface Args { command: string; config: string; out: string; yes: boolean; cache: string; local: Record<string, string> }

const USAGE = `rules-sync <check|plan|open-prs> [options]

  --config <file>   config file (default rules-sync.json)
  --out <dir>       plan output dir (default out/)
  --cache <dir>     clone cache (default .rules-sync-cache/)
  --local <repo>=<dir>  use an existing local checkout instead of cloning (repeatable)
  --yes             open-prs only: actually push and open PRs (default is dry-run)`;

export function parseArgs(argv: string[]): Args {
  const a: Args = { command: '', config: 'rules-sync.json', out: 'out', yes: false, cache: '.rules-sync-cache', local: {} };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    const next = () => {
      const n = argv[++i];
      if (n === undefined) throw new Error(`${v} needs a value`);
      return n;
    };
    if (v === '--config') a.config = next();
    else if (v === '--out') a.out = next();
    else if (v === '--cache') a.cache = next();
    else if (v === '--yes') a.yes = true;
    else if (v === '--local') {
      const [k, d] = next().split('=');
      if (!k || !d) throw new Error('--local expects owner/name=dir');
      a.local[k] = d;
    } else if (v === '-h' || v === '--help') a.command = 'help';
    else if (!a.command && !v.startsWith('-')) a.command = v;
    else throw new Error(`unknown argument: ${v}`);
  }
  return a;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.command || args.command === 'help') {
    console.log(USAGE);
    return args.command ? 0 : 2;
  }
  const config = loadConfig(args.config);
  const opts = { cache: args.cache, local: args.local };
  switch (args.command) {
    case 'check': {
      const { repos } = analyse(config, opts);
      let drift = 0;
      for (const r of repos) {
        const n = r.files.filter((f) => f.status !== 'in-sync').length;
        drift += n;
        console.log(`${r.target.repo}: ${n ? `${n} file(s) out of sync` : 'in sync'}`);
        for (const f of r.files) {
          console.log(`  ${f.status.padEnd(8)} ${f.file}`);
          for (const w of f.warnings) console.log(`           warning: ${w}`);
        }
      }
      console.log(drift ? `check: drift in ${repos.filter(hasDrift).length}/${repos.length} repos` : 'check: all repos in sync');
      return drift ? 1 : 0;
    }
    case 'plan': {
      const { repos } = analyse(config, opts);
      mkdirSync(args.out, { recursive: true });
      for (const r of repos) {
        const patch = r.files.filter((f) => f.status !== 'in-sync').map((f) => unifiedDiff(f.file, f.current, f.desired)).join('');
        const name = join(args.out, `${r.target.repo.replace('/', '__')}.diff`);
        writeFileSync(name, patch);
        console.log(`${r.target.repo}: ${patch ? `${patch.split('\n').length - 1} diff lines -> ${name}` : 'in sync, empty diff'} `);
      }
      return repos.some(hasDrift) ? 1 : 0;
    }
    case 'open-prs': {
      const { repos } = analyse(config, opts);
      for (const r of repos.filter(hasDrift)) {
        const p = planPr(config, r);
        if (!args.yes) {
          console.log(`=== DRY RUN ${p.repo} (pass --yes to apply) ===`);
          console.log(`branch: ${p.branch}\n--- commit message ---\n${p.commitMessage}\n--- PR title ---\n${p.title}\n--- PR body ---\n${p.body}--- commands ---`);
          for (const c of p.commands) console.log(`  ${c}`);
        } else {
          console.log(`${p.repo}: ${applyPr(p, r)}`);
        }
      }
      if (!repos.some(hasDrift)) console.log('open-prs: nothing to do, all repos in sync');
      return 0;
    }
    default:
      console.error(`unknown command: ${args.command} (config ok: ${config.targets.length} targets)\n\n${USAGE}`);
      return 2;
  }
}

main().then((code) => process.exit(code), (e: Error) => {
  console.error(`rules-sync: ${e.message}`);
  process.exit(2);
});
