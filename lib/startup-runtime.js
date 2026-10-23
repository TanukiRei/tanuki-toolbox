import policy from './policy.cjs';
import reports from './reports.cjs';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import shortcuts from './shortcut-controller.cjs';
import settings from './toolbox-settings.cjs';
export function apply(ctx) {
  const profile=ctx.get('profileContext');
  let restore=()=>{};
  try{if(profile?.dir&&profile.installAnchor)restore=shortcuts.watch(ctx,profile);}catch(error){ctx.logger.warn('[Tanuki] Shortcut protection could not start',error);}
  ctx.inject(['pluginManager'], host => {
    const profile=ctx.get('profileContext');
    if(!profile?.dir) return;
    let stopped=false, busy=false, timer;
    async function scan() {
      if(stopped || busy || !settings.startupEnabled(profile)) return;
      busy=true;
      try {
        const all=await host.pluginManager.listBundles();
        const conflicts=policy.selectLiveConflicts(all);
        if(stopped||!settings.startupEnabled(profile)) return;
        const disabled=[];
        const backup=conflicts.length ? reports.backup(profile.dir) : undefined;
        for(const pkg of conflicts) {
          if(stopped||!settings.startupEnabled(profile)) break;
          const result=await host.pluginManager.setBundleEnabled(pkg.name,false);
          disabled.push({name:pkg.name,version:pkg.version,reason:'incompatible-version',success:result.application==='applied'||result.application==='restart-required',application:result.application});
        }
        // Keep the last quarantine evidence when subsequent change events find no conflict.
        let previous;
        try{previous=JSON.parse(readFileSync(join(profile.dir,'.tanuki-toolbox/status.json'),'utf8'));}catch{}
        if(disabled.length || (!scan.reported && !previous?.disabled?.length)) reports.writeReport(profile.dir,{status:'checked',mode:'live',checked:all.filter(p=>p.enabled).length,disabled,...backup ? {backup} : {}});
        scan.reported=true;
      } catch(error) {
        if(!stopped) {
          try{reports.writeReport(profile.dir,{status:'error',mode:'live',code:'scan-failed',disabled:[]});}catch{}
          ctx.logger.warn('[Tanuki] Compatibility scan failed',error);
        }
      } finally { busy=false; }
    }
    const schedule=()=>{clearTimeout(timer);if(settings.startupEnabled(profile))timer=setTimeout(scan,1200);};
    host.on('plugin-manager/changed',schedule);
    host.on('ready',schedule);
    host.on('tanuki/startup',schedule);
    schedule();
    host.effect(()=>()=>{stopped=true;clearTimeout(timer);});
  });
  return async()=>{
    try{if(profile?.dir&&await (await import('./component-state.cjs')).default.enabled(profile,'tanuki-startup-guard')===false){const {default:autostart}=await import('./autostart.cjs');if(autostart.inspect(profile).enabled)await autostart.set(profile,false);}}
    catch(error){ctx.logger.warn('[Tanuki] Login startup could not be removed',error?.message);}
    await restore();
  };
}
