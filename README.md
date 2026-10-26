# rules-sync

Keep repos made from the [BEST-OF-AI-DEV](https://github.com/mogesjohnson/BEST-OF-AI-DEV) template in sync with it.
`rules-sync` compares each target repo's shared files (AGENTS.md, RULES.md, CLAUDE.md, GEMINI.md,
hooks, checker scripts) with a pinned template ref, keeps each repo's `REPO-SPECIFIC` blocks, and
reports or fixes drift.

## Install

```sh
git clone https://github.com/mogesjohnson/rules-sync && cd rules-sync
npm ci && npm run build
node dist/cli.js --help      # or: npm link, then rules-sync --help
```

Needs Node 20+, `git`, and `gh` (authenticated) only for `open-prs --yes`.

## Config: `rules-sync.json`

```json
{
  "template": { "repo": "mogesjohnson/BEST-OF-AI-DEV", "path": "template/", "ref": "ec56890309fd8af5c98f6e0b237468b924d3ad5a" },
  "targets": [
    { "repo": "mogesjohnson/spec-to-tests" },
    { "repo": "mogesjohnson/history-scrub" }
  ],
  "files": ["AGENTS.md", "RULES.md", "CLAUDE.md", "GEMINI.md", ".githooks/*", "scripts/check/*.mjs", ".github/pull_request_template.md"]
}
```

- `template.repo` / `template.path` / `template.ref`: where the template lives. Pin `ref` to a tag or commit.
- `targets[]`: `{ "repo": "owner/name", "path": "sub/dir/" }`; `path` is optional (repo root).
- `files`: globs relative to `template.path` (`*` within a segment, `**` across). Default: the four agent files.

Repos are cloned with `--depth 1` into `.rules-sync-cache/` and never modified. `--local owner/name=dir`
uses an existing checkout instead.

## Commands

| Command | What it does | Exit code |
| --- | --- | --- |
| `check` | Prints `in-sync` / `drifted` / `missing` per repo and file | 1 on any drift |
| `plan [--out out/]` | Writes one unified diff per target (`out/owner__name.diff`) via `git diff --no-index` | 1 on any drift |
| `open-prs` | **Dry-run by default.** Prints the branch, commit message, PR title/body (BEST-OF-AI-DEV PR template, Conventional Commit + `Refs:`/`Agent:` trailers) and the `gh` commands | 0 |
| `open-prs --yes` | Clones fresh, branches, commits, pushes and runs `gh pr create` per drifted target. Never merges. | 0 |

## Marker semantics

Same rules as the template's `scripts/check/template-sync.mjs`, in any comment syntax:

- **Block**: a line containing `REPO-SPECIFIC` (with or without `:`) through a line containing `/REPO-SPECIFIC`.
- **Tail**: a line containing `REPO-SPECIFIC-BELOW` and everything after it.

Shared text comes from the template. The N-th block in the target replaces the N-th block in the
template, marker lines included, so a target's filled-in text survives. If block counts differ, a
warning is printed and unmatched blocks use the template text. Missing files are created from the template.

## Sample output (real run, template @ ec56890, 2026-10-25)

```
$ node dist/cli.js check
mogesjohnson/spec-to-tests: in sync
  in-sync  .githooks/commit-msg
  in-sync  .githooks/pre-commit
  in-sync  .githooks/pre-push
  in-sync  .github/pull_request_template.md
  in-sync  AGENTS.md
  in-sync  CLAUDE.md
  in-sync  GEMINI.md
  in-sync  RULES.md
  in-sync  scripts/check/commit-format.mjs
  in-sync  scripts/check/commit-msg.mjs
  in-sync  scripts/check/gate.mjs
  in-sync  scripts/check/pr-format.mjs
  in-sync  scripts/check/pr-size.mjs
  in-sync  scripts/check/secrets.mjs
  in-sync  scripts/check/template-sync.mjs
mogesjohnson/history-scrub: 10 file(s) out of sync
  missing  .githooks/commit-msg
  missing  .githooks/pre-commit
  missing  .githooks/pre-push
  in-sync  .github/pull_request_template.md
  in-sync  AGENTS.md
  in-sync  CLAUDE.md
  in-sync  GEMINI.md
  in-sync  RULES.md
  missing  scripts/check/commit-format.mjs
  missing  scripts/check/commit-msg.mjs
  missing  scripts/check/gate.mjs
  missing  scripts/check/pr-format.mjs
  missing  scripts/check/pr-size.mjs
  missing  scripts/check/secrets.mjs
  missing  scripts/check/template-sync.mjs
check: drift in 1/2 repos
```

`plan` wrote an empty diff for spec-to-tests and a 777-line diff for history-scrub (10 new files).
With a locally edited spec-to-tests (`--local`, RULES.md headings changed), `check` reported
`drifted RULES.md` and the diff restored only the shared headings; the REPO-SPECIFIC blocks were untouched.

```
$ node dist/cli.js open-prs     # dry-run
=== DRY RUN mogesjohnson/history-scrub (pass --yes to apply) ===
branch: chore/rules-sync-ec56890
--- commit message ---
chore(rules): sync shared rules from template ec56890

Update shared text from mogesjohnson/BEST-OF-AI-DEV@ec56890 and keep
REPO-SPECIFIC blocks unchanged.

Refs: none
Agent: rules-sync
--- PR title ---
...
--- commands ---
  gh repo clone mogesjohnson/history-scrub <workdir> -- --depth 1
  git -C <workdir> switch -c chore/rules-sync-ec56890
  # write 10 file(s) under <workdir>/
  git -C <workdir> add -A
  git -C <workdir> commit -F <commit-message-file>
  git -C <workdir> push -u origin chore/rules-sync-ec56890
  gh pr create --repo mogesjohnson/history-scrub --head chore/rules-sync-ec56890 --title "chore(rules): sync shared rules from template ec56890" --body-file <body-file>
```

## Scheduled check

[`examples/rules-sync-check.yml`](examples/rules-sync-check.yml) runs `check` weekly in GitHub Actions.
Copy it to `.github/workflows/` in the repo that holds your `rules-sync.json`.

## Known gaps

- No unit tests yet; verified by real runs only.
- Targets are compared at their default branch; no per-target ref.
- File modes are not compared (hooks are made executable on write).
- Files removed from the template are not flagged in targets.

## License

MIT
