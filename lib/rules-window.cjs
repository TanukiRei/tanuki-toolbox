'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),{createHash,randomUUID}=require('node:crypto');
const {fail}=require('./rules-store.cjs');
function create(profile,callbacks){
  let alive=true;const windows=new Map(),root=path.resolve(__dirname,'..');
  const palette=value=>Object.fromEntries(['background','foreground','border','muted','tertiary','hover','focus','error'].filter(key=>/^(?:#[0-9a-f]{6}|rgba?\([\d.,%\s]+\))$/i.test(value[key]||'')&&value[key].length<80).map(key=>[key,value[key]]));
  function send(view,value){if(view.closed||!view.child?.stdin.writable)return;const data=JSON.stringify(value)+'\n';if(Buffer.byteLength(data)<=256*1024&&view.child.stdin.writableLength<1024*1024)view.child.stdin.write(data);}
  function stop(view,notify=true){if(view.closed)return view.closing;send(view,{type:'shutdown'});view.closed=true;if(!view.started)view.reject(fail(503,'NATIVE_WINDOW_CLOSED'));clearTimeout(view.startTimer);windows.delete(view.id);for(const item of view.flushes.values()){clearTimeout(item.timer);item.reject(fail(503,'WINDOW_CLOSED'));}view.flushes.clear();view.closing=new Promise(resolve=>{if(!view.child||view.child.exitCode!==null){resolve();return;}const timer=setTimeout(()=>{try{view.child.kill();}catch{}resolve();},1500);view.child.once('exit',()=>{clearTimeout(timer);resolve();});});try{view.child?.stdin.end();}catch{}if(notify&&alive)callbacks.changed(view.id,{detached:false,detaching:false});return view.closing;}
  function motion(value){if(!value||typeof value!=='object')return null;const result={};for(const key of ['x','y','width','height','viewportWidth','viewportHeight','grabX','grabY']){if(!Number.isFinite(value[key])||Math.abs(value[key])>16384)return null;result[key]=value[key];}if(result.width<260||result.height<180||result.viewportWidth<100||result.viewportHeight<100)return null;return {...result,radius:Math.min(40,Math.max(0,Number(value.radius)||15)),duration:Math.min(600,Math.max(0,Number(value.duration)||180)),dragging:value.dragging===true,reduced:value.reduced===true};}
  async function open(id,theme,language,geometry){
    if(!alive)throw fail(503,'STOPPED');const previous=windows.get(id);if(previous){send(previous,{type:'focus'});return previous.ready;}
    if(process.platform!=='win32')throw fail(409,'NATIVE_UNSUPPORTED');if(windows.size>=8)throw fail(429,'TOO_MANY_RULE_WINDOWS');
    const binary=path.join(root,'launcher/RulesWindow.exe'),build=JSON.parse(fs.readFileSync(path.join(root,'launcher/RulesWindow.build.json'),'utf8'));
    const digest=bytes=>createHash('sha256').update(bytes).digest('hex');if(digest(fs.readFileSync(binary))!==build.binarySha256)throw fail(503,'INVALID_NATIVE_BINARY');
    const assets=[{source:binary,name:'RulesWindow.exe',sha:build.binarySha256},...Object.entries(build.assets||{}).map(([name,sha])=>({source:path.join(root,'launcher',name),name:path.basename(name),sha})),{source:path.join(root,'launcher/RulesEditor.html'),name:'RulesEditor.html',sha:digest(fs.readFileSync(path.join(root,'launcher/RulesEditor.html')))}];
    const directory=path.join(profile.dir,'.tanuki-toolbox','rules-runtime',digest(JSON.stringify(assets.map(item=>[item.name,item.sha]))));fs.mkdirSync(directory,{recursive:true});const stat=fs.lstatSync(directory);if(!stat.isDirectory()||stat.isSymbolicLink())throw fail(503,'INVALID_RUNTIME_DIRECTORY');
    for(const item of assets){if(digest(fs.readFileSync(item.source))!==item.sha)throw fail(503,'INVALID_NATIVE_BINARY');const file=path.join(directory,item.name);try{fs.copyFileSync(item.source,file,fs.constants.COPYFILE_EXCL);}catch(error){if(error.code!=='EEXIST')throw error;}const entry=fs.lstatSync(file);if(!entry.isFile()||entry.isSymbolicLink()||entry.size>8*1024*1024||digest(fs.readFileSync(file))!==item.sha)throw fail(503,'INVALID_NATIVE_BINARY');}
    const executable=path.join(directory,'RulesWindow.exe');
    let resolve,reject;const ready=new Promise((a,b)=>{resolve=a;reject=b;}),view={id,child:null,ready,reject,closed:false,flushes:new Map(),queue:Promise.resolve(),buffer:''};windows.set(id,view);
    try{
      view.child=spawn(executable,[String(process.pid)],{windowsHide:true,stdio:['pipe','pipe','ignore']});view.child.stdin.on('error',()=>{});view.child.stdout.setEncoding('utf8');
      view.child.stdout.on('data',chunk=>{
        if(!alive||view.closed)return;view.buffer+=chunk.toString('utf8');if(view.buffer.length>512*1024){stop(view);return;}
        let end;while((end=view.buffer.indexOf('\n'))>=0){const line=view.buffer.slice(0,end);view.buffer=view.buffer.slice(end+1);let message;try{message=JSON.parse(line);}catch{continue;}
          if(message.type==='progress'){view.stage=String(message.stage||'').slice(0,80);}
          else if(message.type==='transition'){callbacks.changed(id,{detaching:true});}
          else if(message.type==='ready'){view.started=true;clearTimeout(view.startTimer);send(view,{type:'state',...callbacks.read(id)});resolve();callbacks.changed(id,{detached:true,detaching:false});}
          else if(message.type==='edit'||message.type==='flushed'){
            const pending=message.requestId&&view.flushes.get(message.requestId);
            view.queue=view.queue.then(async()=>{if(!alive||view.closed)throw fail(503,'STOPPED');const value=await callbacks.update(id,message.rows);if(!alive||view.closed)return;send(view,{type:'saved',editId:message.editId,revision:value.revision});if(pending){clearTimeout(pending.timer);view.flushes.delete(message.requestId);pending.resolve();}}).catch(error=>{send(view,{type:'error',error:error.code||'SAVE_FAILED'});if(pending){clearTimeout(pending.timer);view.flushes.delete(message.requestId);pending.reject(error);}});
          }else if(message.type==='closed'){view.queue.finally(()=>stop(view));}
          else if(message.type==='attach'){view.queue.finally(()=>{stop(view);if(alive)callbacks.changed(id,{detached:false,returnToPanel:true});});}
          else if(message.type==='refresh')send(view,{type:'state',...callbacks.read(id)});
          else if(message.type==='fatal'){try{fs.writeFileSync(path.join(profile.dir,'.tanuki-toolbox','rules-window-last-error.json'),JSON.stringify({at:new Date().toISOString(),stage:String(message.stage||'unknown').slice(0,80),detail:String(message.detail||'').slice(0,120)}));}catch{}reject(fail(503,'NATIVE_UNAVAILABLE'));stop(view);}
        }
      });
      const failed=()=>{if(view.closed)return;try{fs.writeFileSync(path.join(profile.dir,'.tanuki-toolbox','rules-window-last-error.json'),JSON.stringify({at:new Date().toISOString(),stage:view.stage||'bootstrap',detail:'startup-ended-or-timeout'}));}catch{}reject(fail(503,'NATIVE_WINDOW_FAILED'));stop(view);};view.child.once('error',failed);view.child.stdout.once('end',()=>{if(view.started)view.queue.finally(()=>stop(view));else failed();});view.child.once('exit',()=>{if(!view.started)failed();});view.startTimer=setTimeout(failed,20000);
      send(view,{type:'hello',...callbacks.read(id),theme:palette(theme),language,motion:motion(geometry)});await ready;
    }catch(error){stop(view);throw error;}
  }
  async function flush(id,signal){const view=windows.get(id);if(!view||view.closed)return;await view.ready;signal?.throwIfAborted();const requestId=randomUUID();await new Promise((resolve,reject)=>{const item={resolve,reject,timer:setTimeout(()=>{view.flushes.delete(requestId);reject(fail(503,'RULES_WINDOW_FLUSH_TIMEOUT'));},2000)};view.flushes.set(requestId,item);send(view,{type:'flush',requestId});});signal?.throwIfAborted();await view.queue;}
  return {open,flush,has:id=>windows.has(id),state(id,value){const view=windows.get(id);if(view)send(view,{type:'state',...value});},theme(id,value,language){const view=windows.get(id);if(view)send(view,{type:'theme',theme:palette(value),language});},focus(id){const view=windows.get(id);if(view)send(view,{type:'focus'});},async close(id){const view=windows.get(id);if(!view)return;await flush(id);await stop(view);},dispose(){alive=false;return Promise.all([...windows.values()].map(view=>stop(view,false)));}};
}
module.exports={create};
