'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const store=require('./agent-interface-store.cjs'),spec=require('./agent-interface-spec.cjs'),settings=require('./toolbox-settings.cjs');
const {body,sameOrigin}=settings.protocol;
const simple=value=>value&&typeof value==='object'&&!Array.isArray(value);
const fields=(value,names,required=names)=>simple(value)&&Object.keys(value).every(key=>names.includes(key))&&required.every(key=>Object.hasOwn(value,key));
const text=value=>typeof value==='string'&&value.length>0&&value.length<=4096&&!/[\0\r\n]/.test(value);
function safe(value,depth=0){
  if(depth>12)return null;if(typeof value==='string'){let result=value.slice(0,12000);result=result.replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi,'$1[redacted]@').replace(/(?:tki_)[a-f0-9]{64}/g,'[redacted]');return result;}
  if(Array.isArray(value))return value.slice(0,1000).map(item=>safe(item,depth+1));
  if(simple(value))return Object.fromEntries(Object.entries(value).filter(([key])=>!/token|password|credential|authorization|cookie|api[-_]?key|secret|stdout|stderr|output/i.test(key)&&typeof value[key]!=='function').slice(0,100).map(([key,item])=>[key,safe(item,depth+1)]));
  return value??null;
}
async function register(ctx,profile){
  const runtime=ctx.inject(['pluginManager','webServer','connection'],scope=>{
    const manager=scope.pluginManager,dir=store.directory(profile),jobsDir=path.join(dir,'jobs'),session=crypto.randomUUID();
    fs.mkdirSync(jobsDir,{recursive:true,mode:0o700});
    let alive=true,quiescing=false,server=null,address=null,error=null,chain=Promise.resolve(),inFlight=0,starting;
    const sockets=new Set(),reads=new Set(),subscribers=new Set(),audit=[];
    const check=()=>{if(!alive)throw store.fail(503,'INTERFACE_DISABLED');if(quiescing)throw store.fail(409,'DESKTOP_EXITING');};
    const desktop=require('./agent-desktop.cjs').create(profile,session,check);
    let nativeSettings=null;
    scope.inject(['settings'],child=>{const service=child.settings;nativeSettings=service;child.effect(()=>()=>{if(nativeSettings===service)nativeSettings=null;});});
    function appearance(){
      if(!nativeSettings)throw store.fail(503,'NATIVE_SETTINGS_UNAVAILABLE');
      const view=nativeSettings.describe({redactSecrets:true}).find(row=>row.ns==='ui-theme');
      if(!view)throw store.fail(503,'THEME_SETTINGS_UNAVAILABLE');
      return {preference:view.value.preference,revision:view.revision,writable:nativeSettings.writable,basePreference:view.base?.preference,userPreference:view.user?.preference};
    }
    const connection=store.credentials(profile);
    const log=(action,state,requestId)=>{audit.push({at:new Date().toISOString(),action,state,requestId});if(audit.length>100)audit.shift();};
    const reply=(response,status,value)=>{if(response.destroyed||response.writableEnded)return;const bytes=JSON.stringify(value);response.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'",'referrer-policy':'no-referrer'});response.end(bytes);};
    function info(){return {protocol:1,address,key:connection.key,state:address?'listening':'error',error,desktop:desktop.status(),profile:profile.dir};}
    const pick=(item,names)=>Object.fromEntries(names.filter(name=>item[name]!==undefined).map(name=>[name,safe(item[name])]));
    async function plugins(){const [rows,bundles]=await Promise.all([manager.listPlugins(),manager.listBundles()]);check();return {entries:rows.map(row=>pick(row,['entryId','moduleName','enabled','fiberPhase','readOnlyReason','meta'])),bundles:bundles.map(row=>pick(row,['name','version','enabled','installed','removable','error','meta','official']))};}
    function version(file){try{return store.read(file).version;}catch{return null;}}
    function requireMethod(name){if(typeof manager[name]!=='function')throw store.fail(501,'NATIVE_METHOD_UNAVAILABLE');return manager[name].bind(manager);}
    async function execute(route,value){
      check();
      if(route==='/v1/appearance'){
        if(!fields(value,['preference','revision'],['preference'])||!['light','dark','system'].includes(value.preference)||Object.hasOwn(value,'revision')&&(!Number.isSafeInteger(value.revision)||value.revision<0))throw store.fail(400,'INVALID_BODY');
        const before=appearance();
        try{await nativeSettings.mutate('ui-theme',[{op:'set',path:['preference'],value:value.preference}],value.revision??before.revision);}
        catch(reason){if(reason.message==='dsh: profile reload requires the root Include entry')throw store.fail(409,'PROFILE_ROOT_UNAVAILABLE');if(reason.code==='SETTINGS_CONFLICT')throw store.fail(409,'SETTINGS_CONFLICT');throw reason;}
        check();return appearance();
      }
      if(route==='/v1/settings'){const result=await settings.patchPreferences(scope,profile,value,check);if(alive)for(const response of subscribers)if(!response.destroyed&&response.writableLength<8192)response.write('event: settings\ndata: {}\n\n');return result;}
      if(route==='/v1/plugins/enable'){
        if(!fields(value,['entryId','enabled'])||!text(value.entryId)||typeof value.enabled!=='boolean')throw store.fail(400,'INVALID_BODY');
        return requireMethod('setPluginEnabled')(value.entryId,value.enabled);
      }
      if(route==='/v1/bundles/enable'){
        if(!fields(value,['name','enabled'])||!text(value.name)||typeof value.enabled!=='boolean')throw store.fail(400,'INVALID_BODY');
        return requireMethod('setBundleEnabled')(value.name,value.enabled);
      }
      if(route==='/v1/plugins/inspect'||route==='/v1/plugins/install'){
        if(!fields(value,route.endsWith('install')?['spec','enabled']:['spec'],['spec'])||!text(value.spec)||Object.hasOwn(value,'enabled')&&typeof value.enabled!=='boolean')throw store.fail(400,'INVALID_BODY');
        if(route.endsWith('inspect'))return requireMethod('inspect')(value.spec);
        return requireMethod('installBundle')(value.spec,{enabled:value.enabled!==false,requestId:crypto.randomUUID()});
      }
      if(route==='/v1/plugins/remove'){
        if(!fields(value,['name'])||!text(value.name))throw store.fail(400,'INVALID_BODY');
        return requireMethod('removeBundle')(value.name);
      }
      if(route==='/v1/reload'){
        if(!fields(value,[]))throw store.fail(400,'INVALID_BODY');
        if(typeof manager.change!=='function'||typeof manager.publishAndReload!=='function')throw store.fail(501,'NATIVE_METHOD_UNAVAILABLE');
        return manager.change(async result=>Object.assign(result,await manager.publishAndReload()),{stage:'reload'},'bundle');
      }
      if(route.startsWith('/v1/desktop/')){
        if(!fields(value,route.endsWith('/quit')?['allowScheduled']:[],[])||Object.hasOwn(value,'allowScheduled')&&typeof value.allowScheduled!=='boolean')throw store.fail(400,'INVALID_BODY');
        if(manager.packageOperations?.size)throw store.fail(409,'PACKAGE_OPERATION_ACTIVE');
        return desktop.invoke(route.split('/').pop(),value);
      }
      throw store.fail(404,'NOT_FOUND');
    }
    function submit(route,value,id){
      if(!store.uuid(id))throw store.fail(400,'REQUEST_ID_REQUIRED');
      id=id.toLowerCase();
      const file=path.join(jobsDir,id+'.json'),fingerprint=crypto.createHash('sha256').update(JSON.stringify({route,value})).digest('hex');
      try{const previous=store.read(file,512*1024);if(previous.fingerprint!==fingerprint)throw store.fail(409,'REQUEST_ID_REUSED');return previous;}catch(reason){if(reason.code!=='ENOENT')throw reason;}
      if(inFlight>=16)throw store.fail(429,'TOO_MANY_JOBS');check();
      const receipt={protocol:1,requestId:id,action:route,state:'running',fingerprint,acceptedAt:new Date().toISOString(),session};
      // This is synchronous within the host loop: no competing request can claim
      // the same id before the durable receipt is written.
      store.save(file,receipt);inFlight++;log(route,'accepted',id);
      chain=chain.catch(()=>{}).then(async()=>{
        let acknowledge;
        try{check();const result=await execute(route,value);acknowledge=result?.ack;if(result?.accepted&&route.startsWith('/v1/desktop/'))quiescing=true;receipt.result=safe(result);receipt.state=result?.application==='failed'||result?.application==='cancelled'||result?.ok===false?'failed':'completed';}
        catch(reason){receipt.state='failed';receipt.error={code:/^[A-Z][A-Z0-9_]*$/.test(reason.code||reason.message)?reason.code||reason.message:'OPERATION_FAILED',status:reason.status||503};}
        finally{receipt.finishedAt=new Date().toISOString();if(Buffer.byteLength(JSON.stringify(receipt))>256*1024)receipt.result={truncated:true,application:receipt.result?.application};try{store.save(file,receipt);log(route,receipt.state,id);acknowledge?.();store.trim(jobsDir,session);}finally{inFlight--;}}
      });
      return receipt;
    }
    async function handle(request,response){
      const controller=new AbortController();reads.add(controller);response.once('close',()=>controller.abort());
      try{
        check();
        const expectedHost='127.0.0.1:'+connection.port;
        // Node's fetch also sends Sec-Fetch-Mode: cors. It is not evidence of a
        // browser origin. Browsers supply Origin and/or Sec-Fetch-Site; reject
        // those while accepting real local Agents using Node's standard fetch.
        if(request.socket.remoteAddress!=='127.0.0.1'||request.headers.host!==expectedHost||request.headers.origin!==undefined||request.headers['sec-fetch-site']!==undefined)throw store.fail(403,'LOCAL_AGENT_REQUIRED');
        if(!store.authorized(request.headers.authorization||'','Bearer '+connection.key))throw store.fail(401,'UNAUTHORIZED');
        const url=new URL(request.url,'http://'+expectedHost);if(url.search)throw store.fail(400,'QUERY_NOT_SUPPORTED');
        const route=url.pathname,method=request.method;
        if(method==='GET'){
          let value;
          if(route==='/v1/status')value={protocol:1,version:version(path.join(__dirname,'../package.json')),dshVersion:version(profile.installAnchor),platform:process.platform,pid:process.pid,ready:true,desktop:desktop.status(),paths:{profile:profile.dir,toolbox:path.resolve(__dirname,'..'),nativeConfig:path.join(profile.dir,'cordis.patch.yml'),jobs:jobsDir},capabilities:spec.operations.map(op=>op.method+' '+op.path)};
          else if(route==='/v1/operations')value=spec;
          else if(route==='/v1/plugins')value=await plugins();
          else if(route==='/v1/settings')value=settings.readPreferences(profile);
          else if(route==='/v1/appearance')value=appearance();
          else if(route==='/v1/logs')value={events:audit,scope:'Agent interface actions only. No chat, model secrets or request bodies.'};
          else if(route==='/v1/desktop/status')value=await desktop.invoke('status');
          else if(route.startsWith('/v1/jobs/')){
            const id=route.slice('/v1/jobs/'.length).toLowerCase();if(!store.uuid(id))throw store.fail(400,'INVALID_REQUEST_ID');
            try{value=store.read(path.join(jobsDir,id+'.json'),512*1024);}catch(reason){if(reason.code==='ENOENT')throw store.fail(404,'JOB_NOT_FOUND');throw reason;}
            if(value.state==='running'&&value.session!==session)value={...value,state:'interrupted',code:'PREVIOUS_HOST_ENDED_VERIFY_ACTUAL_STATE'};
          }else throw store.fail(404,'NOT_FOUND');
          check();if(!controller.signal.aborted)reply(response,200,safe(value));return;
        }
        if(!spec.operations.some(op=>op.method===method&&op.path===route))throw store.fail(405,'METHOD_OR_ROUTE_NOT_SUPPORTED');
        if(!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type']||''))throw store.fail(415,'JSON_REQUIRED');
        const bytes=await body(request,controller.signal,65536);check();let value;try{value=JSON.parse(bytes.toString('utf8'));}catch{throw store.fail(400,'INVALID_JSON');}
        const result=submit(route,value,request.headers['x-request-id']);reply(response,202,{protocol:1,requestId:result.requestId,state:result.state,job:'/v1/jobs/'+result.requestId});
      }catch(reason){reply(response,reason.status||503,{ok:false,code:reason.status?reason.code||reason.message:'INTERFACE_UNAVAILABLE'});}
      finally{reads.delete(controller);}
    }
    // This route uses DSH's existing per-renderer authorization and a non-simple
    // same-origin header. Only the trusted settings page receives the API key.
    scope.effect(()=>scope.webServer.register({name:'tanuki-toolbox.agent-interface',kind:'exact',path:'/tanuki-toolbox/agent-interface',async handler(request,response){
      let refusal=403;try{refusal=scope.get('connection')?.requestRejection(request);}catch{}
      if(refusal!==undefined||!sameOrigin(request)){reply(response,403,{error:'UNAUTHORIZED'});return;}
      if(request.method!=='GET'){reply(response,405,{error:'METHOD_NOT_ALLOWED'});return;}
      try{await starting;check();reply(response,200,info());}catch{reply(response,503,{error:'INTERFACE_UNAVAILABLE'});}
    }}));
    scope.effect(()=>scope.webServer.register({name:'tanuki-toolbox.agent-interface.events',kind:'exact',path:'/tanuki-toolbox/agent-interface/events',handler(request,response){
      let refusal=403;try{refusal=scope.get('connection')?.requestRejection(request);}catch{}
      if(refusal!==undefined||!sameOrigin(request)){reply(response,403,{error:'UNAUTHORIZED'});return;}
      if(!alive||request.method!=='GET'||subscribers.size>=32){reply(response,503,{error:'UNAVAILABLE'});return;}
      response.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store','x-accel-buffering':'no'});response.write('event: settings\ndata: {}\n\n');subscribers.add(response);response.once('close',()=>subscribers.delete(response));
    }}));
    starting=(async()=>{
      try{
        server=http.createServer({maxHeaderSize:8192},(request,response)=>void handle(request,response));
        server.headersTimeout=10000;server.requestTimeout=15000;server.keepAliveTimeout=1000;server.maxRequestsPerSocket=20;server.maxConnections=32;
        server.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));socket.on('error',()=>{});});
        server.on('clientError',(_error,socket)=>socket.destroy());
        await new Promise((resolve,reject)=>{server.once('error',reject);server.listen({host:'127.0.0.1',port:connection.port,exclusive:true},()=>{server.off('error',reject);resolve();});});
        check();server.on('error',()=>{if(alive){error='LISTENER_UNAVAILABLE';address=null;}});
        if(!connection.port){connection.port=server.address().port;store.save(path.join(dir,'connection.json'),connection);}
        address='http://127.0.0.1:'+connection.port;desktop.record(true);desktop.prepare();
      }catch(reason){error=reason.code==='EADDRINUSE'?'ADDRESS_IN_USE':reason.code||'LISTENER_UNAVAILABLE';try{server?.close();}catch{}address=null;}
    })();
    scope.effect(()=>()=>{
      alive=false;address=null;for(const controller of reads)controller.abort();reads.clear();
      // Revoke new requests and keep-alive clients immediately; keep only saved
      // connection metadata and already-started native file/package transactions.
      try{server?.close();server?.closeAllConnections();}catch{}for(const socket of sockets)socket.destroy();sockets.clear();for(const response of subscribers)response.end();subscribers.clear();desktop.close();audit.length=0;
    });
    return starting;
  });
  // Cordis awaits startup promises, but their resolved value must be void or
  // a disposer. Its thenable Fiber resolves to a Fiber, which is not an effect.
  // Await it for readiness/errors without returning that internal object.
  await runtime;
}
module.exports={register};
