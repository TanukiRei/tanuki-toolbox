'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFile,spawn}=require('node:child_process');
const state=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'TanukiToolbox');
const powershell=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
const source=path.join(__dirname,'restart-host.ps1');
const launcherHash=()=>require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,'ProtectedLauncher.exe'))).digest('hex');
const environment=()=>{const env={...process.env,PSModulePath:path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','Modules')};delete env.NODE_OPTIONS;delete env.NODE_PATH;delete env.ELECTRON_RUN_AS_NODE;return env;};
const baseArgs=['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass'];
function launchHelper(args,dir,logFd){
  // DETACHED_PROCESS makes Windows PowerShell 5 exit 0 before running -File.
  // Merely removing detached is insufficient: its shared console can close when
  // the host exits. Start-Process creates a separate hidden console on Windows.
  // Keep the bootstrap waiting so its exit still means the worker has exited.
  const literal=value=>"'"+value.replace(/'/g,"''")+"'";
  const quote=value=>'"'+value.replace(/(\\*)"/g,'$1$1\\"').replace(/(\\+)$/,'$1$1')+'"';
  const command=`$ErrorActionPreference='Stop'; try { $p=Start-Process -FilePath ${literal(powershell)} -ArgumentList ${literal(args.map(quote).join(' '))} -WorkingDirectory ${literal(dir)} -WindowStyle Hidden -RedirectStandardOutput ${literal(path.join(dir,'helper.stdout.log'))} -RedirectStandardError ${literal(path.join(dir,'helper.log'))} -PassThru; $p.WaitForExit(); exit $p.ExitCode } catch { [Console]::Error.WriteLine($_.Exception.ToString()); exit 1 }`;
  return spawn(powershell,[...baseArgs,'-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{env:environment(),cwd:dir,detached:false,windowsHide:true,stdio:['ignore',logFd,logFd]});
}
const validId=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validCode=value=>typeof value==='string'&&/^[A-Z][A-Z0-9_]*$/.test(value);
function diagnosticCode(text){
  if(/ParameterBinding|NamedParameterNotFound|MissingMandatoryParameter|PositionalParameterNotFound/.test(text))return 'HELPER_ARGUMENT_REJECTED';
  if(/ParserError|ParseException|UnexpectedToken/.test(text))return 'HELPER_PARSE_FAILED';
  return null;
}
function helperError(error,stderr=''){return error?.code==='ENOENT'?'HELPER_NOT_FOUND':error?.code==='EACCES'||error?.code==='EPERM'?'HELPER_ACCESS_DENIED':error?.killed?'HELPER_TIMEOUT':diagnosticCode(stderr)||'HELPER_EXECUTION_FAILED';}
async function probe(signal){
  if(process.platform!=='win32')return {available:false,code:'WINDOWS_REQUIRED'};
  let profile,expectedHash;
  try{
    const settings=JSON.parse(fs.readFileSync(path.join(state,'settings.json'),'utf8').replace(/^\ufeff/,''));
    if(settings.installComplete!==true||typeof settings.profileDirectory!=='string'||!path.isAbsolute(settings.profileDirectory))return {available:false,code:'REOPEN_NOT_READY'};
    profile=path.resolve(settings.profileDirectory);expectedHash=launcherHash();
    const actual=fs.realpathSync(path.join(__dirname,'launch.cjs')).toLowerCase();
    const configured=fs.realpathSync(path.join(profile,'node_modules','dsh-local-plugin-center','launcher','launch.cjs')).toLowerCase();
    if(actual!==configured)return {available:false,code:'PROFILE_MISMATCH'};
  }catch{return {available:false,code:'REOPEN_NOT_READY'};}
  return new Promise((resolve,reject)=>{
    execFile(powershell,[...baseArgs,'-File',source,'-Mode','Probe','-HostId',String(process.pid),'-HostPath',process.execPath,'-ProfilePath',profile,'-LauncherHash',expectedHash],{signal,env:environment(),cwd:state,encoding:'utf8',windowsHide:true,timeout:20000,maxBuffer:32768},(error,stdout,stderr)=>{
      if(signal?.aborted){reject(signal.reason||new Error('ABORTED'));return;}
      try{
        const result=JSON.parse(stdout.trim().replace(/^\ufeff/,''));
        if(!result||typeof result.available!=='boolean'||!validCode(result.code))throw new Error();
        if(result.available){
          for(const identity of [result.host,result.desktop])if(!identity||!Number.isSafeInteger(identity.pid)||identity.pid<=0||typeof identity.born!=='string'||!/^\d{17,19}$/.test(identity.born)||typeof identity.path!=='string')throw new Error();
          if(error||result.host.pid!==process.pid||result.desktop.pid===process.pid)throw new Error();
        }
        resolve({...result,profile,expectedHash});
      }catch{resolve({available:false,code:error?helperError(error,stderr):'INVALID_HELPER_RESPONSE'});}
    });
  });
}
function transactions(){const key=Symbol.for('tanuki.external-restart.v1');return globalThis[key]||(globalThis[key]={active:null,results:new Map()});}
async function restart(requestId){
  if(typeof requestId!=='string'||!validId.test(requestId))return {status:'unavailable',code:'INVALID_REQUEST'};
  requestId=requestId.toLowerCase();
  const tx=transactions();
  if(tx.results.has(requestId))return tx.results.get(requestId);
  if(tx.active)return {status:'busy',code:'RESTART_IN_PROGRESS',requestId};
  tx.active=requestId;
  const operation=(async()=>{
    let stage='RESTART_PREPARATION_FAILED',childStarted=false,logFd;
    try{
      const ready=await probe();
      if(!ready.available)return {status:'unavailable',code:ready.code,requestId};
      const dir=path.join(state,'restart-transactions',requestId);
      stage='TRANSACTION_CREATE_FAILED';
      // Never overwrite or replay a transaction left by a previous host lifetime.
      fs.mkdirSync(path.dirname(dir),{recursive:true});
      try{fs.mkdirSync(dir);}catch(error){if(error.code==='EEXIST')return {status:'unknown',code:'TRANSACTION_ALREADY_EXISTS',requestId};throw error;}
      const script=path.join(dir,'restart-host.ps1'),receipt=path.join(dir,'receipt.json');
      stage='HELPER_COPY_FAILED';fs.copyFileSync(source,script,fs.constants.COPYFILE_EXCL);
      const args=[...baseArgs,'-File',script,'-Mode','Restart','-HostId',String(process.pid),'-HostPath',process.execPath,'-ProfilePath',ready.profile,'-LauncherHash',ready.expectedHash,'-HostBorn',ready.host.born,'-DesktopId',String(ready.desktop.pid),'-DesktopBorn',ready.desktop.born,'-Receipt',receipt];
      stage='HELPER_LOG_FAILED';logFd=fs.openSync(path.join(dir,'bootstrap.log'),'ax');
      stage='HELPER_SPAWN_FAILED';
      const child=launchHelper(args,dir,logFd);
      let exited=false,exitCode=null;
      child.once('exit',code=>{exited=true;exitCode=code;});
      await new Promise((resolve,reject)=>{child.once('error',reject);child.once('spawn',resolve);});
      childStarted=true;child.unref();fs.closeSync(logFd);logFd=undefined;
      const readReceipt=()=>{
        try{
          const result=JSON.parse(fs.readFileSync(receipt,'utf8').replace(/^\ufeff/,''));
          if(!validCode(result.code)||!['accepted','launched','unavailable','failed','unknown'].includes(result.status))return null;
          return {...result,requestId};
        }catch{return null;}
      };
      const deadline=Date.now()+25000;
      while(Date.now()<deadline){
        const result=readReceipt();if(result)return result;
        if(exited){
          // A missing receipt cannot prove no destructive work happened: retain the latch.
          let detail;for(const name of ['helper.log','bootstrap.log']){try{detail=detail||diagnosticCode(fs.readFileSync(path.join(dir,name),'utf8'));}catch{}}
          const failure={status:'unknown',code:detail||'HELPER_EXITED_WITHOUT_RECEIPT',exitCode,requestId};
          try{fs.writeFileSync(path.join(dir,'controller-result.json'),JSON.stringify(failure),{flag:'wx'});}catch{}
          return failure;
        }
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      return {status:'unknown',code:'RESTART_ACK_TIMEOUT',requestId};
    }catch(error){return {status:childStarted?'unknown':'unavailable',code:stage==='HELPER_SPAWN_FAILED'?helperError(error):stage,requestId};}
    finally{if(logFd!==undefined)try{fs.closeSync(logFd);}catch{}}
  })();
  tx.results.set(requestId,operation);
  while(tx.results.size>32)tx.results.delete(tx.results.keys().next().value);
  const result=await operation;
  if(result.status==='unavailable'&&tx.active===requestId)tx.active=null;
  return result;
}
module.exports={probe,restart};
