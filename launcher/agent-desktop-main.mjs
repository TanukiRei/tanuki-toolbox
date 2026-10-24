// Loaded by the tiny desktop hook only for an explicit Agent IPC request.
// Normal startup and the disabled component do not load this module or listen.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {timingSafeEqual} from 'node:crypto';
let active=false;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function handleDesktopControl(options,argv){
  const id=argv.find(arg=>arg.startsWith('--tanuki-agent-control='))?.split('=')[1];if(!uuid.test(id||''))return;
  const dir=path.join(options.profile,'.tanuki-toolbox','agent-interface'),requestFile=path.join(dir,'requests',id+'.request.json'),replyFile=path.join(dir,'requests',id+'.reply.json');
  const require=createRequire(import.meta.url),root=path.join(options.profile,'node_modules/dsh-local-plugin-center');
  const read=file=>{const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>8192)throw Error('INVALID_REQUEST');return JSON.parse(fs.readFileSync(file,'utf8'));};
  let request;try{request=read(requestFile);}catch{return;}
  const key=read(path.join(dir,'connection.json')).key;
  if(typeof request.token!=='string'||typeof key!=='string'||request.token.length!==key.length||!timingSafeEqual(Buffer.from(request.token),Buffer.from(key))||request.requestId!==id||!Number.isFinite(request.at)||Math.abs(Date.now()-request.at)>30000)return;
  const respond=value=>{const temp=replyFile+'.tmp';fs.writeFileSync(temp,JSON.stringify({protocol:1,requestId:id,pid:process.pid,...value}),{mode:0o600});fs.renameSync(temp,replyFile);};
  const error=code=>Object.assign(Error(code),{code});
  const enabled=async()=>{const current=read(path.join(dir,'runtime.json'));return current.enabled===true&&current.session===request.session&&current.mainPid===process.pid&&await require(path.join(root,'lib/component-state.cjs')).enabled({dir:options.profile,installAnchor:options.installAnchor},'tanuki-agent-interface')===true;};
  let locked=false,accepted=false,ownsAction=false;
  try{
    if(!await enabled())throw error('INTERFACE_DISABLED');
    if(!options.available())throw error('DESKTOP_BUSY');
    const inspect=async()=>{const state=await options.inspect();if(!state||typeof state.activeTasks!=='boolean'||typeof state.scheduledTasks!=='boolean')throw error('TASK_STATE_UNKNOWN');return state;};
    if(request.action==='status'){respond({ok:true,ready:!active,version:options.version,...await inspect()});return;}
    if(!['quit','restart'].includes(request.action))throw error('INVALID_ACTION');
    if(active)throw error('DESKTOP_BUSY');active=true;ownsAction=true;
    const first=await inspect();if(first.activeTasks)throw error('ACTIVE_TASKS');
    if(request.action==='quit'&&first.scheduledTasks&&request.allowScheduled!==true)throw error('SCHEDULED_TASKS');
    let executable=options.executable;
    if(request.action==='restart'){
      const profile={dir:options.profile,installAnchor:options.installAnchor};
      const guard=await require(path.join(root,'lib/component-state.cjs')).enabled(profile,'tanuki-startup-guard');
      if(guard===null)throw error('STARTUP_GUARD_UNKNOWN');
      if(guard===true&&require(path.join(root,'lib/toolbox-settings.cjs')).startupEnabled(profile)){
        const base=path.join(process.env.LOCALAPPDATA,'TanukiToolbox'),config=read(path.join(base,'settings.json'));
        const same=(a,b)=>typeof a==='string'&&path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
        executable=path.join(base,'ProtectedLauncher.exe');
        if(config.installComplete!==true||!same(config.profileDirectory,options.profile)||!same(config.installDirectory,path.dirname(options.executable))||!fs.statSync(executable).isFile())throw error('PROTECTED_LAUNCHER_UNAVAILABLE');
      }
    }
    locked=true;const busy=await options.admission('lock');if(typeof busy!=='boolean')throw error('TASK_STATE_UNKNOWN');
    if(busy||!options.available())throw error('ACTIVE_TASKS');
    const final=await inspect();if(final.activeTasks)throw error('ACTIVE_TASKS');
    if(request.action==='quit'&&final.scheduledTasks&&request.allowScheduled!==true)throw error('SCHEDULED_TASKS');
    if(!await enabled())throw error('INTERFACE_DISABLED');
    respond({ok:true,accepted:true,action:request.action});accepted=true;
    // Wait only for this transaction's HTTP acknowledgment, with a bounded fallback.
    const until=Date.now()+1800,ack=path.join(dir,'requests',id+'.ack');
    while(Date.now()<until&&!fs.existsSync(ack))await new Promise(resolve=>setTimeout(resolve,25));
    if(request.action==='restart')options.relaunch(executable);
    options.quit();
  }catch(reason){accepted=false;respond({ok:false,code:reason.code||'CONTROL_UNAVAILABLE'});}
  finally{if(!accepted){if(locked)try{await options.admission('unlock');}catch{}if(ownsAction)active=false;}try{fs.unlinkSync(requestFile);}catch{}}
}
