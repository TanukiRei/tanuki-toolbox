'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createRequire}=require('node:module'),{pathToFileURL}=require('node:url'),{execFile}=require('node:child_process');
function findInstallDirectory(anchor){
  // Desktop's profile anchor is the nested @deepseek-ai/dsh manifest,
  // while CLI callers can use the manifest at the runtime root.
  let dir=path.dirname(path.resolve(anchor));
  for(;;){
    if(fs.existsSync(path.join(dir,'DeepSeek Harness.exe')))return fs.realpathSync.native(dir);
    const parent=path.dirname(dir);if(parent===dir)break;dir=parent;
  }
  throw new Error('Cannot locate the DSH installation for this profile.');
}
function report(profile,value){
  const dir=path.join(profile.dir,'.tanuki-toolbox');fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,'shortcut-status.json'),temp=file+'.'+process.pid+'.tmp';
  fs.writeFileSync(temp,JSON.stringify({...value,at:new Date().toISOString()},null,2));fs.renameSync(temp,file);
}
const enabled=async profile=>{const on=await require('./component-state.cjs').enabled(profile,'tanuki-startup-guard');return on===true?require('./toolbox-settings.cjs').startupEnabled(profile):on;};
// Serialize irreversible shortcut work across disable/enable and hot replacement.
// Idle controllers leave no entries or timers in this shared queue.
function serialize(key,job){
  const symbol=Symbol.for('tanuki.shortcut-jobs.v1'),jobs=globalThis[symbol]||(globalThis[symbol]=new Map());
  const prior=jobs.get(key)||Promise.resolve(),next=prior.catch(()=>{}).then(job);
  jobs.set(key,next);
  return next.finally(()=>{if(jobs.get(key)===next)jobs.delete(key);if(!jobs.size&&globalThis[symbol]===jobs)delete globalThis[symbol];});
}

function watch(ctx,profile){
  if(process.platform!=='win32')return ()=>{};
  const install=findInstallDirectory(profile.installAnchor);
  const state=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'TanukiToolbox');
  const source=path.join(__dirname,'../launcher'),stableScript=path.join(state,'manage-shortcuts.ps1');
  let stopped=false,timer,flight=null,again=false,last=null,lastAt=0,retryAt=0;
  async function perform(value){
    if(value===null)return;
    if(!value&&!fs.existsSync(path.join(state,'shortcut-state.json'))&&!fs.existsSync(path.join(state,'shortcut-backups','latest.json'))){report(profile,{status:'restored',managed:0,changed:0,warnings:[]});return;}
    if(value){
      fs.mkdirSync(state,{recursive:true});
      fs.copyFileSync(path.join(source,'manage-shortcuts.ps1'),stableScript);
    }
    // Stable helper survives package replacement/removal long enough to restore the links.
    const script=fs.existsSync(stableScript)?stableScript:path.join(source,'manage-shortcuts.ps1');
    let previous;try{previous=JSON.parse(fs.readFileSync(path.join(profile.dir,'.tanuki-toolbox','shortcut-status.json'),'utf8'));}catch{}
    // Keep the last failure/partial result visible while a background retry runs.
    if(!previous||previous.status==='pending'||(value&&previous.status==='restored')||!value)report(profile,{status:value?'enabling':'restoring',managed:previous?.managed||0,warnings:[]});
    const args=['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-Mode',value?'Enable':'Restore','-StateRoot',state,'-InstallDirectory',install,'-ProfileDirectory',profile.dir];
    const boot=await import(pathToFileURL(createRequire(profile.installAnchor).resolve('@deepseek-ai/dsh-app-boot')).href);
    args.push('-Locale',require('../launcher/locale.cjs').resolveLocale({profile:profile.dir,installAnchor:profile.installAnchor,boot}));
    if(value)args.push('-SourceLauncher',path.join(source,'ProtectedLauncher.exe'));
    const systemRoot=process.env.SystemRoot||'C:\\Windows';
    const env={...process.env,PSModulePath:path.join(systemRoot,'System32','WindowsPowerShell','v1.0','Modules')};
    await new Promise((resolve,reject)=>execFile(path.join(systemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'),args,{env,windowsHide:true,timeout:180000,maxBuffer:1024*1024},(error,stdout,stderr)=>{if(error)error.shortcutDetail=stderr?.trim().slice(-2000)||error.message;error?reject(error):resolve();}));
  }
  function apply(value){
    return serialize(state,async()=>{
      // A newer user choice supersedes a queued job. Never re-protect after disable.
      if(value&&stopped)return;
      if(await enabled(profile)!==value)return;
      await perform(value);
      if(await require('./component-state.cjs').enabled(profile,'tanuki-startup-guard')===true){const autostart=require('./autostart.cjs');const state=autostart.inspect(profile);if(state.enabled&&state.status==='on')await autostart.set(profile,true);}
    });
  }
  async function sync(force=false){
    if(stopped)return;
    if(flight){again=true;return flight;}
    if(!force&&Date.now()<retryAt)return;
    flight=(async()=>{
      const value=await enabled(profile);
      if(stopped||value===null||(!force&&value===last&&(!value||Date.now()-lastAt<300000)))return;
      await apply(value);last=value;lastAt=Date.now();retryAt=0;
    })().catch(error=>{
      last=null;retryAt=Date.now()+300000;
      try{report(profile,{status:'error',managed:0,detail:error.shortcutDetail||error.message,warnings:[{code:'operation-failed'}]});}catch{}
      ctx.logger.warn('[Tanuki] Shortcut setup could not complete',error);
    }).finally(()=>{flight=null;if(again&&!stopped){again=false;schedule();}});
    return flight;
  }
  function schedule(){clearTimeout(timer);if(!stopped)timer=setTimeout(()=>void sync(),600);}
  const off=ctx.on('plugin-manager/changed',schedule),offStartup=ctx.on('tanuki/startup',()=>{last=null;retryAt=0;schedule();});
  const periodic=setInterval(()=>void sync(),300000);
  schedule();
  return async()=>{
    stopped=true;clearTimeout(timer);clearInterval(periodic);off();offStartup();
    if(flight)await flight;
    try{
      // Shutdown/hot reload leaves enabled=true. Only an explicit persisted disable restores.
      if(await enabled(profile)===false)await apply(false);
    }catch(error){try{report(profile,{status:'error',managed:0,warnings:[{code:'restore-failed'}]});}catch{};ctx.logger.warn('[Tanuki] Shortcut restore could not complete',error);}
  };
}
module.exports={watch,findInstallDirectory};
