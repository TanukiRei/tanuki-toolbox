'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {thirdParty,SELF}=require('../lib/policy.cjs');
const {backup,writeReport}=require('../lib/reports.cjs');
// Only inspect manifests. Never import third-party plugin code during preflight.
async function preflight({profile,installAnchor,boot,dryRun=false}) {
  const source=path.join(profile,'package.json');
  const original=fs.readFileSync(source,'utf8');
  const manifest=JSON.parse(original);
  const selected=manifest.dsh?.profile?.bundles;
  if(!Array.isArray(selected)) throw new Error('INVALID_PROFILE');
  const loaded=boot.loadProfileDirectory('tanuki',profile,installAnchor);
  const home=path.dirname(path.dirname(profile));
  const homePatches=boot.loadOptionalPatches('tanuki',path.join(home,'cordis.patch.yml')) ?? [];
  const entries=boot.composeEntries([...loaded.layers.map(l=>l.patches),loaded.patches,homePatches]);
  const guard=entries.find(e=>e.id==='tanuki-startup-guard');
  // Expressions are deliberately not executed by this helper. DSH evaluates them itself.
  const enabled=require('../lib/toolbox-settings.cjs').startupEnabled({dir:profile}) && selected.includes(SELF) && guard && (guard.disabled===undefined||guard.disabled===false);
  if(!enabled) return {status:'off',disabled:[],checked:0};
  const exemptions=boot.readProfileVersionExemptions(profile);
  const disabled=[],unknown=[];
  let checked=0;
  for(const name of selected) {
    if(!thirdParty(name)) continue;
    try {
      const dir=boot.resolveBundleDir('tanuki',name,installAnchor,profile);
      const pkg=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8'));
      checked++;
      const issue=boot.evaluatePluginCompatibility(pkg,exemptions);
      if(issue&&!issue.exempted) disabled.push({name,version:pkg.version,reason:'incompatible-version',peers:issue.peers,success:!dryRun});
    } catch { unknown.push(name); }
  }
  const reject=new Set(disabled.map(p=>p.name));
  const retained=selected.filter(n=>!reject.has(n));
  // Put this insertion-only bundle first. Actual guaranteed priority comes from this preflight running before Electron.
  const next=[SELF,...retained.filter(n=>n!==SELF)];
  const changed=JSON.stringify(next)!==JSON.stringify(selected);
  let backupPath;
  if(changed&&!dryRun) {
    if(fs.readFileSync(source,'utf8')!==original) throw new Error('PROFILE_CHANGED');
    if(fs.existsSync(path.join(profile,'.plugin-manager','run.json'))) throw new Error('PACKAGE_OPERATION_IN_PROGRESS');
    backupPath=backup(profile);
    // Use DSH's manifest writer; dependencies and user patch contents remain intact.
    boot.writeProfileBundles(profile,manifest,next);
  }
  const report={status:'checked',mode:'preflight',runtime:boot.getDshRuntimeVersion(),checked,disabled,unknown,priority:'before-app',dryRun,...backupPath?{backup:backupPath}:{}};
  if(!dryRun) writeReport(profile,report);
  return report;
}
module.exports={preflight};
