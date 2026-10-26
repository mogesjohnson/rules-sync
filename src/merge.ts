// Marker-aware merge, using the same marker rules as BEST-OF-AI-DEV's
// scripts/check/template-sync.mjs, in any comment syntax:
//   block: a line containing "REPO-SPECIFIC" (with or without ":") through a line containing "/REPO-SPECIFIC"
//   tail:  a line containing "REPO-SPECIFIC-BELOW" and everything after it
// Shared text comes from the template; slot contents (marker lines included) come from the target.

export interface Segment { kind: 'shared' | 'slot' | 'tail'; lines: string[] }

const isTail = (l: string) => l.includes('REPO-SPECIFIC-BELOW');
const isClose = (l: string) => l.includes('/REPO-SPECIFIC');
const isOpen = (l: string) => !isTail(l) && !isClose(l) && /REPO-SPECIFIC\b/.test(l);

export function segments(text: string): Segment[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const segs: Segment[] = [];
  let cur: Segment = { kind: 'shared', lines: [] };
  const push = () => { if (cur.lines.length) segs.push(cur); };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (cur.kind === 'shared' && isTail(l)) {
      push();
      segs.push({ kind: 'tail', lines: lines.slice(i) });
      return segs;
    }
    if (cur.kind === 'shared' && isOpen(l)) {
      push();
      cur = { kind: 'slot', lines: [l] };
      if (isClose(l)) { push(); cur = { kind: 'shared', lines: [] }; }
      continue;
    }
    cur.lines.push(l);
    if (cur.kind === 'slot' && isClose(l)) { push(); cur = { kind: 'shared', lines: [] }; }
  }
  push();
  return segs;
}

export interface MergeResult { text: string; warnings: string[] }

/** Template text with each slot filled from the target's slot at the same position. */
export function merge(template: string, target: string): MergeResult {
  const t = segments(template);
  const g = segments(target);
  const tSlots = t.filter((s) => s.kind !== 'shared');
  const gSlots = g.filter((s) => s.kind !== 'shared');
  const warnings: string[] = [];
  if (tSlots.length !== gSlots.length) {
    warnings.push(`slot count differs (template ${tSlots.length}, target ${gSlots.length}); unmatched slots use template text`);
  }
  let k = 0;
  const out: string[] = [];
  for (const s of t) {
    if (s.kind === 'shared') { out.push(...s.lines); continue; }
    const mine = gSlots[k++];
    out.push(...(mine && mine.kind === s.kind ? mine.lines : s.lines));
  }
  return { text: out.join('\n'), warnings };
}
