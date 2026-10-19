'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const failure=code=>Object.assign(new Error(code),{status:409});
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function locations(profile){return {link:path.join(process.env.APPDATA||path.join(os.homedir(),'AppData','Roaming'),'Microsoft','Windows','Start Menu','Programs','Startup','Tanuki DeepSeek Harness.lnk'),receipt:path.join(profile.dir,'.tanuki-toolbox','autostart.json'),launcher:path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'TanukiToolbox','ProtectedLauncher.exe')};}
function inspect(profile){
  if(process.platform!=='win32')return {supported:false,enabled:false,status:'unsupported'};
  const files=locations(profile);let receipt;
  try{receipt=JSON.parse(fs.readFileSync(files.receipt,'utf8'));}catch{}
  let stat;try{stat=fs.lstatSync(files.link);}catch(error){if(error.code==='ENOENT')return {supported:true,enabled:false,status:'off'};throw error;}
  const owned=stat.isFile()&&!stat.isSymbolicLink()&&stat.size<65536&&receipt?.schema===1&&receipt.sha256===digest(fs.readFileSync(files.link));
  return {supported:true,enabled:true,status:owned?'on':'changed'};
}
function serialize(profile,job){
  const key=Symbol.for('tanuki.autostart-jobs.v1'),jobs=globalThis[key]||(globalThis[key]=new Map()),id=path.resolve(profile.dir);
  const next=(jobs.get(id)||Promise.resolve()).catch(()=>{}).then(job);jobs.set(id,next);
  return next.finally(()=>{if(jobs.get(id)===next)jobs.delete(id);if(!jobs.size)delete globalThis[key];});
}
function set(profile,enabled,check=()=>{}){return serialize(profile,async()=>{
  check();if(process.platform!=='win32')throw failure('WINDOWS_REQUIRED');
  const files=locations(profile),state=inspect(profile);
  if(state.status==='changed')throw failure('AUTOSTART_MANUALLY_CHANGED');
  if(!enabled){
    if(state.enabled)fs.unlinkSync(files.link);
    try{fs.unlinkSync(files.receipt);}catch(error){if(error.code!=='ENOENT')throw error;}
    return inspect(profile);
  }
  if(await require('./component-state.cjs').enabled(profile,'tanuki-startup-guard')!==true)throw failure('STARTUP_GUARD_REQUIRED');
  check();
  let config;try{config=JSON.parse(fs.readFileSync(path.join(path.dirname(files.launcher),'settings.json'),'utf8').replace(/^\ufeff/,''));}catch{throw failure('PROTECTED_LAUNCH_NOT_READY');}
  if(config.installComplete!==true||typeof config.profileDirectory!=='string'||path.resolve(config.profileDirectory).toLowerCase()!==path.resolve(profile.dir).toLowerCase()||!fs.existsSync(files.launcher))throw failure('PROTECTED_LAUNCH_NOT_READY');
  if(digest(fs.readFileSync(files.launcher))!==digest(fs.readFileSync(path.join(__dirname,'../launcher/ProtectedLauncher.exe'))))throw failure('PROTECTED_LAUNCH_NOT_READY');
  if(state.enabled)return state;
  const dir=path.dirname(files.receipt);fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(path.dirname(files.link),{recursive:true});
  const temp=path.join(dir,'autostart-'+crypto.randomUUID()+'.lnk'),record=files.receipt+'.'+crypto.randomUUID()+'.tmp';
  try{
    const systemRoot=process.env.SystemRoot||'C:\\Windows',environment={...process.env,PSModulePath:path.join(systemRoot,'System32','WindowsPowerShell','v1.0','Modules')};
    await new Promise((resolve,reject)=>require('node:child_process').execFile(path.join(systemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'../launcher/create-autostart.ps1'),'-OutputPath',temp,'-Launcher',files.launcher],{env:environment,windowsHide:true,timeout:20000,maxBuffer:8192},error=>error?reject(error):resolve()));
    check();if(await require('./component-state.cjs').enabled(profile,'tanuki-startup-guard')!==true)throw failure('STARTUP_GUARD_REQUIRED');check();
    const bytes=fs.readFileSync(temp);
    fs.writeFileSync(record,JSON.stringify({schema:1,sha256:digest(bytes)}),{flag:'wx'});
    fs.renameSync(record,files.receipt);
    // Exclusive copy avoids replacing an entry created by the user in the meantime.
    fs.copyFileSync(temp,files.link,fs.constants.COPYFILE_EXCL);
    return inspect(profile);
  }finally{for(const file of [temp,record])try{fs.unlinkSync(file);}catch{}}
});}
module.exports={inspect,set};
