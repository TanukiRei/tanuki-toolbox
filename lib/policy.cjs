'use strict';
const SELF = 'dsh-local-plugin-center';
function thirdParty(name) { return typeof name === 'string' && name !== SELF && !name.startsWith('@deepseek-ai/'); }
function selectLiveConflicts(bundles) {
  return bundles.filter(p => p.enabled && p.installed && p.removable && !p.readOnlyReason && thirdParty(p.name) && p.error?.code === 'incompatible-version');
}
function enabledUpdateCounts(summary, bundles, rows) {
  const live = new Map(rows.map(r => [r.entryId, r]));
  const candidates = new Map(bundles.filter(p => p.installed && p.official !== true && p.optional !== true && p.removable !== false && p.enabled && (!p.rows?.length || p.rows.some(r => live.get(r.entryId)?.enabled === true))).map(p => [p.name, p]));
  const found = new Set();
  let official = 0, installed = 0;
  for (const update of summary?.packages ?? []) {
    if (found.has(update.name)) continue;
    const pkg = candidates.get(update.name);
    if (!pkg) continue;
    found.add(update.name);
    if (pkg.optional && !pkg.installed) official++; else installed++;
  }
  return { total: official + installed, official, installed, names: [...found] };
}
module.exports = { SELF, thirdParty, selectLiveConflicts, enabledUpdateCounts };
