'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {sameOrigin,body,save}=require('./toolbox-settings.cjs').protocol;
const {validId,fail}=require('./rules-store.cjs');
const DAY=86400000,RETENTION=30*DAY,ORIGINAL=Symbol.for('cordis.original');
const encodeSegment=id=>id==='.'?'~002E':id==='..'?'~002E~002E':[...id].map(ch=>/^[A-Za-z0-9._-]$/.test(ch)?ch:'~'+ch.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0')).join('');
function read(file){
  try{const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>4*1024*1024)throw Error();const value=JSON.parse(fs.readFileSync(file,'utf8'));
    if(value.schema!==1||!Array.isArray(value.items)||value.items.length>10000)throw Error();const ids=new Set();
    for(const item of value.items){if(!validId(item.sessionId)||ids.has(item.sessionId)||!Number.isSafeInteger(item.deletedAt)||item.expiresAt!==item.deletedAt+RETENTION||!['moving','trashed','restoring','purging'].includes(item.phase)||item.cwd!==undefined&&(typeof item.cwd!=='string'||!path.isAbsolute(item.cwd)))throw Error();ids.add(item.sessionId);}return value;
  }catch(error){if(error.code==='ENOENT')return {schema:1,items:[]};throw fail(503,'RECYCLE_STORE_INVALID');}
}
function register(ctx,profile){
  return ctx.inject(['workspaceRegistry','sessionQuery','sessionPersistence','sessions','agents','sessionController'],scope=>{
    let alive=true,timer=null,queue=Promise.resolve(),cleaning=false;const file=path.join(profile.dir,'.tanuki-toolbox','recycle-bin.json'),streams=new Set(),heartbeats=new Set(),requests=new Set();let state=read(file);
    const registry=scope.get('workspaceRegistry'),query=scope.get('sessionQuery'),persistence=scope.get('sessionPersistence');
    const handles=new WeakMap(),agentsService=scope.get('agents'),agentsTarget=agentsService[ORIGINAL]||agentsService;
    // Retain only the native, exact AgentHandle teardown capability. Disposing
    // the Agent's inner scope directly would re-enter its own teardown chain.
    for(const key of ['create','resume']){const original=agentsTarget[key],descriptor=Object.getOwnPropertyDescriptor(agentsTarget,key);if(typeof original!=='function')continue;async function capture(...args){const handle=await original.apply(this,args);if(alive&&handle?.agent&&typeof handle.dispose==='function')handles.set(handle.agent[ORIGINAL]||handle.agent,handle.dispose);return handle;}scope.effect(()=>{Object.defineProperty(agentsTarget,key,{configurable:true,writable:true,value:capture});return()=>{if(agentsTarget[key]===capture){if(descriptor)Object.defineProperty(agentsTarget,key,descriptor);else delete agentsTarget[key];}};});}
    const exists=id=>state.items.find(item=>item.sessionId===id);
    function commit(){save(file,state);publish();}
    const clearToken=()=>createHash('sha256').update(JSON.stringify(state.items.map(({sessionId,deletedAt})=>[sessionId,deletedAt]).sort((a,b)=>a[0].localeCompare(b[0])))).digest('hex');
    function snapshot(){return {items:state.items.map(({sessionId,deletedAt,expiresAt,workspaceId,phase})=>({sessionId,deletedAt,expiresAt,workspaceId,phase})),retentionDays:30,clearToken:clearToken()};}
    function publish(){if(!alive)return;const message='data: '+JSON.stringify(snapshot())+'\n\n';for(const response of streams)if(!response.destroyed){if(response.writableLength>1024*1024)response.destroy();else response.write(message)};}
    function enqueue(action){const task=queue.catch(()=>{}).then(action);queue=task;return task;}
    async function move(id){
      if(exists(id))return;if(state.items.length>=10000)throw fail(429,'RECYCLE_BIN_FULL');const lease=await query.observeSession(id,{projectionMode:'none'});let header;try{header=lease.header;if(header.origin==='subagent')throw fail(409,'SUBAGENT_NOT_DELETABLE');}finally{lease[Symbol.dispose]?.();}
      if(!alive)throw fail(503,'STOPPED');const workspace=registry.list().find(item=>item.sessionIds.includes(id));const deletedAt=Date.now();
      const row={sessionId:id,deletedAt,expiresAt:deletedAt+RETENTION,workspaceId:workspace?.id||workspace?.workspaceId,cwd:header.cwd,phase:'moving'};
      state.items.push(row);commit();
      try{await registry.archiveSession(id,{stopActivity:true});row.phase='trashed';commit();}
      catch(error){if(registry.archivedSessionIds.includes(id))row.phase='trashed';else state.items=state.items.filter(item=>item!==row);commit();throw error;}
      schedule();
    }
    async function restore(id){
      const row=exists(id);if(!row)throw fail(404,'NOT_IN_RECYCLE_BIN');if(row.phase==='purging'||row.expiresAt<=Date.now())throw fail(409,'RECYCLE_EXPIRED');
      // Archiving retains the native workspace accounting slot. Re-register
      // the original directory only if its workspace was removed meanwhile.
      if(row.cwd){const workspace=registry.list().find(item=>item.path===row.cwd)||await registry.create(row.cwd);await workspace.attachSession(id);}
      row.phase='restoring';commit();await nativeUnarchive.call(registry,id);state.items=state.items.filter(item=>item!==row);commit();schedule();
    }
    const registryTarget=registry[ORIGINAL]||registry,nativeUnarchive=registryTarget.unarchiveSession,unarchiveDescriptor=Object.getOwnPropertyDescriptor(registryTarget,'unarchiveSession');
    function unarchive(id){if(alive&&exists(id))throw fail(409,'RESTORE_FROM_RECYCLE_BIN');return nativeUnarchive.call(this,id);}
    scope.effect(()=>{Object.defineProperty(registryTarget,'unarchiveSession',{configurable:true,writable:true,value:unarchive});return()=>{if(registryTarget.unarchiveSession===unarchive){if(unarchiveDescriptor)Object.defineProperty(registryTarget,'unarchiveSession',unarchiveDescriptor);else delete registryTarget.unarchiveSession;}};});
    // Defence in depth for queued work and direct/non-UI callers. Native
    // archive admission already blocks tasks and their subagent descendants.
    scope.on('agent/pre-step',(payload,next)=>alive&&exists(payload.agent.id)?Promise.resolve({kind:'reject'}):next());
    async function purge(row){
      const id=row.sessionId;if(exists(id)!==row||row.phase!=='purging'&&row.expiresAt>Date.now())throw fail(409,'NOT_EXPIRED');
      if(persistence.name!=='session-persistence-jsonl'||typeof persistence.findLog!=='function'||typeof persistence.locate!=='function')throw fail(503,'UNSUPPORTED_PURGE_BACKEND');
      row.phase='purging';commit();
      await scope.parallel('tanuki/recycle-purging',id);
      const agent=scope.get('agents').get(id);if(agent){if(agent.status==='running')throw fail(409,'SESSION_STILL_ACTIVE');const dispose=handles.get(agent[ORIGINAL]||agent);if(!dispose)throw fail(503,'CANNOT_RELEASE_SESSION');await dispose();handles.delete(agent[ORIGINAL]||agent);}
      if(scope.get('sessions').get(id))throw fail(409,'SESSION_STILL_RETAINED');
      let handle;try{
        const stat=await persistence.stat(id);if(stat){
        if(stat.header.id!==id||stat.header.cwd!==row.cwd)throw fail(409,'SESSION_IDENTITY_CHANGED');
        // Take the backend's cross-process write lease before touching exactly
        // this session's canonical generation files. Never guess a profile path.
        handle=await persistence.open(id,'write');const selected=await persistence.findLog(id),located=persistence.locate(stat.header);
        const root=await fs.promises.realpath(persistence.root),directory=path.dirname(located.path),real=await fs.promises.realpath(directory),relative=path.relative(root,real);
        if(!relative||relative.startsWith('..')||path.isAbsolute(relative)||real!==path.resolve(directory)||!selected||path.dirname(path.resolve(selected.sourcePath))!==real)throw fail(503,'UNSAFE_SESSION_DIRECTORY');
        const parts=relative.split(path.sep);if(parts.length!==2||parts[1]!==encodeSegment(id))throw fail(503,'UNSAFE_SESSION_DIRECTORY');
        const entries=await fs.promises.readdir(real,{withFileTypes:true});
        // Keep the POSIX lease inode: deleting it could let another process
        // acquire a different lock. Do not recursively delete unknown files.
        const logs=entries.filter(entry=>/^session(?:\.v[1-9]\d*)?\.jsonl(?:\.zstd)?$/.test(entry.name));
        if(!logs.length||entries.some(entry=>entry.isSymbolicLink()))throw fail(503,'UNRECOGNIZED_SESSION_LAYOUT');
        for(const entry of logs){const target=path.join(real,entry.name),stat=await fs.promises.lstat(target);if(!stat.isFile()||stat.isSymbolicLink())throw fail(503,'UNSAFE_SESSION_ARTIFACT');await fs.promises.unlink(target);}
        persistence.coldLogMemo?.delete(id);}
      }finally{await handle?.close();}
      // Reconcile the native full-text index as well as the raw log, so a
      // permanently deleted conversation cannot survive as a search result.
      if(typeof query._serialized==='function'&&typeof query._reconcile==='function'&&query.config?.openAt!=='never')await query._serialized(undefined,async()=>{await query._ensureReady();await query._reconcile();});
      query._observations?.cache?.delete(id);
      // Remove the per-session Rules sidecar along with its conversation.
      const rules=path.join(profile.dir,'.tanuki-toolbox','rules',createHash('sha256').update(id).digest('hex')+'.json');try{const stat=fs.lstatSync(rules);if(stat.isFile()&&!stat.isSymbolicLink())fs.unlinkSync(rules);}catch(error){if(error.code!=='ENOENT')throw error;}
      for(const workspace of registry.list())if(workspace.sessionIds.includes(id))await workspace.detachSession(id);
      await registry.unpinSession(id);await nativeUnarchive.call(registry,id);
      for(const key of ['headers','sessionPaths','missingSessionPaths','invalidSessionPaths'])registry[key]?.delete(id);
      scope.emit('api-session/removed',id);state.items=state.items.filter(item=>item!==row);commit();
    }
    async function deletePermanently(id,deletedAt){
      const row=exists(id);if(!row)throw fail(404,'NOT_IN_RECYCLE_BIN');
      // A restored and subsequently deleted task has a new identity in the
      // Bin. Do not apply a stale menu confirmation to that new entry.
      if(row.deletedAt!==deletedAt)throw fail(409,'RECYCLE_BIN_CHANGED');
      row.phase='purging';commit();let failedCount=0;
      try{await purge(row);}catch(error){failedCount=1;scope.logger.warn('[Tanuki] Recycle Bin deletion deferred: '+String(error.code||error.name));}
      schedule(true);return failedCount;
    }
    async function clear(token){
      // Bind the irreversible action to the exact set the user confirmed.
      // A newly deleted conversation must never join an earlier confirmation.
      if(token!==clearToken())throw fail(409,'RECYCLE_BIN_CHANGED');
      const rows=[...state.items];for(const row of rows)row.phase='purging';commit();let failedCount=0;
      for(const row of rows){try{await purge(row);}catch(error){failedCount++;scope.logger.warn('[Tanuki] Recycle Bin clear deferred: '+String(error.code||error.name));}}
      schedule(true);return failedCount;
    }
    function schedule(retry=false){clearTimeout(timer);if(!alive||!state.items.length)return;const next=Math.min(...state.items.map(item=>item.phase==='purging'?0:item.expiresAt));timer=setTimeout(()=>void cleanup(),Math.min(2147483647,Math.max(retry&&next<=Date.now()?300000:1000,next-Date.now())));timer.unref?.();}
    async function cleanup(){if(!alive||cleaning)return;cleaning=true;try{await enqueue(async()=>{for(const row of [...state.items]){if(!alive)break;try{if(row.phase==='restoring'){await nativeUnarchive.call(registry,row.sessionId);state.items=state.items.filter(item=>item!==row);commit();}else if(row.phase==='purging'||row.expiresAt<=Date.now())await purge(row);else if(!registry.archivedSessionIds.includes(row.sessionId)||row.phase==='moving'){await registry.archiveSession(row.sessionId,{stopActivity:true});row.phase='trashed';commit();}}catch(error){scope.logger.warn('[Tanuki] Recycle Bin operation deferred: '+String(error.code||error.name));}}});}finally{cleaning=false;schedule(true);}}
    scope.inject(['webServer','connection'],host=>host.effect(()=>host.webServer.register({name:'tanuki-toolbox.recycle-bin',kind:'exact',path:'/tanuki-toolbox/recycle-bin',async handler(request,response){
      let refusal=403;try{refusal=host.get('connection')?.requestRejection(request);}catch{}if(refusal!==undefined){response.writeHead(403);response.end();return;}
      const send=(status,value)=>{if(!response.destroyed&&!response.writableEnded){response.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});response.end(JSON.stringify(value));}};
      if(!alive){send(503,{error:'STOPPED'});return;}if(!['GET','POST'].includes(request.method)){send(405,{error:'METHOD_NOT_ALLOWED'});return;}if(request.method==='POST'&&!sameOrigin(request)){send(403,{error:'BAD_ORIGIN'});return;}
      const controller=new AbortController();requests.add(controller);let heartbeat;const close=()=>{controller.abort();requests.delete(controller);streams.delete(response);clearInterval(heartbeat);heartbeats.delete(heartbeat);};response.once('close',close);
      try{const params=new URL(request.url,'http://localhost').searchParams;
        if(request.method==='GET'){
          if(params.get('watch')==='1'){if(streams.size>=16)throw fail(429,'TOO_MANY_VIEWS');response.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store','x-accel-buffering':'no'});response.flushHeaders?.();streams.add(response);response.write('data: '+JSON.stringify(snapshot())+'\n\n');heartbeat=setInterval(()=>{if(alive&&!response.destroyed)response.write(': recycle-bin\n\n');},25000);heartbeats.add(heartbeat);return;}
          send(200,snapshot());return;
        }
        if(!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type']||''))throw fail(415,'JSON_REQUIRED');
        const value=JSON.parse((await body(request,controller.signal,2048)).toString('utf8'));
        if(!value||typeof value!=='object')throw fail(400,'INVALID_ACTION');
        if(value.action==='clear'){if(typeof value.token!=='string'||!/^[a-f0-9]{64}$/.test(value.token))throw fail(400,'INVALID_ACTION');}
        else if(!validId(value.sessionId)||!['move','restore','purge'].includes(value.action)||value.action==='purge'&&!Number.isSafeInteger(value.deletedAt))throw fail(400,'INVALID_ACTION');
        controller.signal.throwIfAborted();if(!alive)throw fail(503,'STOPPED');
        // Once accepted, finish the small durable transaction even if the
        // caller disconnects or disables the component midway.
        const failedCount=await enqueue(()=>value.action==='clear'?clear(value.token):value.action==='purge'?deletePermanently(value.sessionId,value.deletedAt):value.action==='move'?move(value.sessionId):restore(value.sessionId));send(200,{...snapshot(),...(['clear','purge'].includes(value.action)?{failedCount}:{})});
      }catch(error){send(error.status||503,{error:error.code||'RECYCLE_UNAVAILABLE'});}finally{if(!streams.has(response)){response.off('close',close);requests.delete(controller);}}
    }})));
    void cleanup();scope.effect(()=>async()=>{alive=false;clearTimeout(timer);for(const controller of requests)controller.abort();requests.clear();for(const heartbeat of heartbeats)clearInterval(heartbeat);heartbeats.clear();for(const response of streams)response.end();streams.clear();await queue.catch(()=>{});});
  });
}
module.exports={register};
