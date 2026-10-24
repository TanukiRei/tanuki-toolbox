'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {spawn,execFileSync}=require('node:child_process');
const {preflight}=require('./preflight.cjs');
const {writeReport}=require('../lib/reports.cjs');
const {prepareLaunch,recordLaunch}=require('../lib/launch-session.cjs');
const {resolveLocale,failureText}=require('./locale.cjs');
const os=require('node:os');
const options={install:path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData/Local'),'Programs','DeepSeek Harness'),profile:path.join(process.env.DSH_HOME||path.join(os.homedir(),'.dsh'),'profiles','desktop')};
if(process.env.TANUKI_DSH_INSTALL)options.install=path.resolve(process.env.TANUKI_DSH_INSTALL);
if(process.env.TANUKI_DSH_PROFILE)options.profile=path.resolve(process.env.TANUKI_DSH_PROFILE);
// Node's ESM cache keys are case-sensitive even on Windows. Launch and resolve
// native modules from one physical spelling so profile services share boot state.
options.install=fs.realpathSync.native(options.install);
options.profile=fs.realpathSync.native(options.profile);
let locale=resolveLocale({profile:options.profile});
async function main() {
  const dryRun=process.argv.includes('--dry-run');
  const installAnchor=path.join(options.install,'resources','app.asar','dsh','package.json');
  const app=path.join(options.install,'DeepSeek Harness.exe');
  const boot=await import(pathToFileURL(path.join(path.dirname(installAnchor),'node_modules','@deepseek-ai','dsh-app-boot','lib','index.js')).href);
  locale=resolveLocale({profile:options.profile,installAnchor,boot});
  let running=false;
  if(process.platform==='win32'&&!dryRun) {
    const output=execFileSync('tasklist.exe',['/FI','IMAGENAME eq DeepSeek Harness.exe','/FO','CSV','/NH'],{encoding:'utf8',windowsHide:true});
    running=output.split(/\r?\n/).some(line=>{const m=line.match(/^"DeepSeek Harness\.exe","(\d+)"/i);return m&&Number(m[1])!==process.pid;});
  }
  let result;
  if(!running) {
    try {
      result=await preflight({profile:options.profile,installAnchor,boot,dryRun});
      if(dryRun) process.stdout.write(JSON.stringify(result,null,2)+'\n');
    } catch(error) {
      if(!dryRun) writeReport(options.profile,{status:'error',mode:'preflight',code:'scan-failed',disabled:[]});
      // Do not silently claim a protected launch when the check failed.
      throw error;
    }
  }
  if(!dryRun) {
    const separator=process.argv.indexOf('--');
    const appArgs=separator<0?[]:process.argv.slice(separator+1);
    // Must happen before Electron opens Chromium's cookie database, not in a host plugin.
    if(!running&&result?.status!=='off') {
      const cleanup=require('./auth-cookie-cleanup.cjs').cleanAuthCookies({profile:options.profile,args:appArgs});
      if(cleanup.status==='cleaned')process.stdout.write('Tanuki local authentication cleanup: removed '+cleanup.removed+' old cookies; backup saved.\n');
      else if(cleanup.status==='skipped')process.stderr.write('Tanuki local authentication cleanup skipped: '+cleanup.reason+'\n');
    }
    const {env,token}=prepareLaunch(process.env,running?null:result); delete env.ELECTRON_RUN_AS_NODE;
    await new Promise((resolve,reject)=>{
      // Only the preflight helper is hidden; the application must open visibly.
      const child=spawn(app,appArgs,{env,detached:true,stdio:'ignore',windowsHide:false});
      child.once('error',reject);child.once('spawn',()=>{
        try{recordLaunch(options.profile,token,child.pid,result);}catch(error){console.warn('Tanuki launch receipt unavailable:',error.message);}
        child.unref();resolve();
      });
    });
  }
}
main().catch(error=>{
  const i=process.argv.indexOf('--error-file');
  if(i>=0&&process.argv[i+1]) {
    try{fs.writeFileSync(process.argv[i+1],'\ufeff'+failureText(locale).join('\r\n'),'utf16le');}catch{}
  }
  process.stderr.write('Tanuki Protected Launch: '+String(error)+'\n');process.exitCode=1;
});
