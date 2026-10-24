'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const store=require('./agent-interface-store.cjs'),installer=require('../launcher/agent-desktop-install.cjs');
const root=path.resolve(__dirname,'..');
function create(profile,session,check){
  const dir=store.directory(profile),setupFile=path.join(dir,'desktop-setup.json'),runtimeFile=path.join(dir,'runtime.json');
  let worker=null,stopped=false,state={state:'unsupported'},pending=new Set();
  const env=()=>{const value={...process.env};for(const name of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','NODE_PATH','TANUKI_PROTECTED_SESSION'])delete value[name];return value;};
  function prepare(){
    if(process.platform!=='win32')return state;
    try{
      if(path.basename(process.execPath).toLowerCase()!=='deepseek harness.exe')return state={state:'unsupported',code:'DESKTOP_HOST_REQUIRED'};
      const info=installer.inspect(process.execPath),bridge=fs.readFileSync(path.join(root,'launcher/agent-desktop-main.mjs'));
      if(info.installed){const manifest=store.read(path.join(dir,'desktop-adapter.json'));if(manifest.patchedMainSha256!==installer.hash(info.main)||!installer.sameArchive(manifest.archive,info.archive))throw store.fail(503,'ADAPTER_CHANGED');if(manifest.bridgeSha256===installer.hash(bridge)&&installer.hash(fs.readFileSync(path.join(path.dirname(info.archive),'tanuki-agent-control.mjs')))===manifest.bridgeSha256)return state={state:'ready'};}
      else if(!info.compatible)return state={state:'unsupported',code:'DESKTOP_VERSION_UNSUPPORTED'};
      try{const prior=store.read(setupFile);if(prior.state==='waiting'&&prior.mainPid===process.ppid&&Number.isInteger(prior.workerPid)){process.kill(prior.workerPid,0);return state={state:'waiting'};}}catch{}
      const build=store.read(path.join(root,'launcher/AgentSetup.build.json')),binary=fs.readFileSync(path.join(root,'launcher/AgentSetup.exe'));if(installer.hash(binary)!==build.binarySha256)throw store.fail(503,'INVALID_SETUP_BINARY');
      const payload=['AgentSetup.exe','agent-desktop-install.cjs','agent-desktop-main.mjs'];
      const snapshot=path.join(dir,'setup',crypto.randomUUID());fs.mkdirSync(snapshot,{recursive:true,mode:0o700});
      for(const file of payload)fs.copyFileSync(path.join(root,'launcher',file),path.join(snapshot,file),fs.constants.COPYFILE_EXCL);
      const plan=path.join(snapshot,'plan.json');store.save(plan,{schema:1,profile:profile.dir,installAnchor:profile.installAnchor,executable:process.execPath,bridgeSha256:installer.hash(bridge)});
      check();worker=spawn(path.join(snapshot,'AgentSetup.exe'),[String(process.ppid),process.execPath,plan],{windowsHide:true,detached:true,stdio:'ignore'});
      worker.on('error',()=>{if(!stopped){state={state:'error',code:'SETUP_WORKER_UNAVAILABLE'};store.save(setupFile,state);}});
      worker.once('exit',code=>{if(!stopped&&code!==0){state={state:'error',code:'SETUP_WORKER_ENDED'};store.save(setupFile,state);}});
      worker.unref();state={state:'waiting'};store.save(setupFile,{...state,mainPid:process.ppid,workerPid:worker.pid});return state;
    }catch(reason){return state={state:'error',code:reason.code||'SETUP_UNAVAILABLE'};}
  }
  function status(){if(state.state==='waiting')try{const value=store.read(setupFile);if(value.state==='error')return value;}catch{}return {...state};}
  async function invoke(action,args={}){
    check();if(state.state!=='ready')throw store.fail(409,state.state==='unsupported'?'DESKTOP_UNSUPPORTED':'DESKTOP_ADAPTER_PENDING');
    const id=crypto.randomUUID(),requests=path.join(dir,'requests');fs.mkdirSync(requests,{recursive:true,mode:0o700});
    const requestFile=path.join(requests,id+'.request.json'),replyFile=path.join(requests,id+'.reply.json'),ackFile=path.join(requests,id+'.ack'),token=store.credentials(profile).key;
    const files=fs.readdirSync(requests);for(const name of files)if(/^[0-9a-f-]{36}\.(?:request\.json|reply\.json|ack)$/.test(name))try{const file=path.join(requests,name);if(Date.now()-fs.statSync(file).mtimeMs>60000)fs.unlinkSync(file);}catch{}
    store.save(requestFile,{schema:1,requestId:id,token,action,allowScheduled:args.allowScheduled===true,at:Date.now(),session});
    let child;try{child=spawn(process.execPath,['--tanuki-agent-control='+id],{env:env(),detached:true,windowsHide:true,stdio:'ignore'});}catch{throw store.fail(503,'IPC_SENDER_UNAVAILABLE');}
    let spawnError=false;child.once('error',()=>{spawnError=true;});child.unref();
    const controller=new AbortController();pending.add(controller);
    try{
      const until=Date.now()+12000;
      while(Date.now()<until){check();if(controller.signal.aborted)throw store.fail(503,'INTERFACE_DISABLED');if(spawnError)throw store.fail(503,'IPC_SENDER_UNAVAILABLE');
        try{const value=store.read(replyFile);if(value.requestId!==id||value.pid!==process.ppid)throw store.fail(503,'IPC_INSTANCE_MISMATCH');if(!value.ok)throw store.fail(409,value.code||'CONTROL_REFUSED');
          if(value.accepted)return {...value,ack:()=>{try{fs.writeFileSync(ackFile,'1',{flag:'wx',mode:0o600});}catch{}}};
          return value;
        }catch(error){if(error.code!=='ENOENT')throw error;}
        await new Promise(resolve=>{const timer=setTimeout(done,40);function done(){controller.signal.removeEventListener('abort',done);clearTimeout(timer);resolve();}controller.signal.addEventListener('abort',done,{once:true});});
      }throw store.fail(504,'DESKTOP_IPC_TIMEOUT');
    }finally{pending.delete(controller);try{fs.unlinkSync(requestFile);}catch{}try{fs.unlinkSync(replyFile);}catch{}}
  }
  function record(enabled){store.save(runtimeFile,{schema:1,enabled,session,mainPid:process.ppid,hostPid:process.pid});}
  return {prepare,status,invoke,record,close(){stopped=true;for(const controller of pending)controller.abort();pending.clear();
    // Normal exit/hot update keeps an accepted one-shot setup transaction alive.
    // An explicit disabled switch revokes it and cancels only our own helper.
    void require('./component-state.cjs').enabled(profile,'tanuki-agent-interface').then(enabled=>{if(enabled!==true){try{const current=store.read(runtimeFile);if(current.session===session)record(false);}catch{}if(worker?.exitCode===null)try{worker.kill();}catch{}}}).catch(()=>{try{record(false);}catch{}});
  }};
}
module.exports={create};
