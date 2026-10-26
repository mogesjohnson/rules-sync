#!/usr/bin/env node
import { loadConfig } from './config.js';

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
  switch (args.command) {
    default:
      console.error(`unknown command: ${args.command} (config ok: ${config.targets.length} targets)\n\n${USAGE}`);
      return 2;
  }
}

main().then((code) => process.exit(code), (e: Error) => {
  console.error(`rules-sync: ${e.message}`);
  process.exit(2);
});
