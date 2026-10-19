'use strict';
// Optional Models enhancement. No provider scans or network work until an
// explicitly viewed model/provider requests its advertised capabilities.
const fs=require('node:fs'),path=require('node:path'),{createHash,randomUUID}=require('node:crypto');
const {sameOrigin,body,save,serial}=require('./toolbox-settings.cjs').protocol;
const ORIGINAL=Symbol.for('cordis.original'),MAX=2*1024*1024;
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const idOK=value=>typeof value==='string'&&value.length>0&&value.length<=1024&&!/[\x00-\x1f\x7f]/.test(value);
const pair=(provider,model)=>JSON.stringify([provider,model]),key=(session,provider,model)=>JSON.stringify([session,provider,model]);
const fail=(status,message)=>Object.assign(new Error(message),{status,code:'TANUKI_GATEWAY_SPEED'});
const cleanHeaders=headers=>Object.fromEntries(Object.entries(headers||{}).filter(([name])=>!['x-home-ai-service-tier','service_tier'].includes(name.toLowerCase())));
const signature=profile=>createHash('sha256').update(JSON.stringify([profile.baseURL,profile.api||'openai-completions',profile.apiKeyEnv||'',profile.headers||{}])).digest('hex');
function read(file){
  try{const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>MAX)throw Error();const value=JSON.parse(fs.readFileSync(file,'utf8'));
    if(value.schema!==1||!Array.isArray(value.capabilities)||!Array.isArray(value.preferences)||value.capabilities.length>256||value.preferences.length>4096)throw Error();
    if(value.capabilities.some(row=>!plain(row)||!idOK(row.provider)||!/^[a-f0-9]{64}$/.test(row.signature)||!Array.isArray(row.models)||row.models.length>8192||row.models.some(model=>!idOK(model.id)||typeof model.fast!=='boolean'))||value.preferences.some(row=>!Array.isArray(row)||row.length!==4||!row.slice(0,3).every(idOK)||!['standard','fast'].includes(row[3])))throw Error();
    return value;
  }catch(error){if(error.code==='ENOENT')return {schema:1,capabilities:[],preferences:[]};throw fail(503,'SPEED_STORE_UNAVAILABLE');}
}
async function boundedJSON(response,signal){
  if(Number(response.headers.get('content-length'))>MAX)throw fail(413,'CATALOG_TOO_LARGE');
  const reader=response.body?.getReader();if(!reader)throw fail(502,'INVALID_CAPABILITIES');let size=0;const chunks=[];
  try{while(true){signal.throwIfAborted();const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX)throw fail(413,'CATALOG_TOO_LARGE');chunks.push(value);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
function register(ctx,profile){
  const file=path.join(profile.dir,'.tanuki-toolbox','gateway-speed.json');
  let alive=true,storeError=null,runtime=null,runtimeCtx=null,data;try{data=read(file);}catch(error){storeError=error;data={schema:1,capabilities:[],preferences:[]};}
  const caps=new Map(data.capabilities.map(row=>[row.provider,row])),preferences=new Map(data.preferences.map(([session,provider,model,mode])=>[key(session,provider,model),mode]));
  const checked=new Map(),errors=new Map(),pending=new Map(),turns=new Map(),results=new Map(),clients=new Set(),controllers=new Set(),wrappers=new Map();
  const persist=()=>{if(storeError)throw storeError;if(caps.size>256||preferences.size>4096)throw fail(413,'SPEED_STORE_FULL');const value={schema:1,capabilities:[...caps.values()],preferences:[...preferences].map(([id,mode])=>[...JSON.parse(id),mode])};if(Buffer.byteLength(JSON.stringify(value))>MAX)throw fail(413,'SPEED_STORE_FULL');save(file,value);};
  function descriptor(provider,snapshot,adapter){
    try{adapter ||= runtime?.registration(provider)?.adapter;if(!adapter||typeof adapter.streamWithSnapshot!=='function'||typeof adapter.config?.resolveApiKey!=='function')return null;snapshot ||= adapter.current();const config=snapshot.profiles.get(provider);if(!config?.baseURL||(config.api||'openai-completions')!=='openai-completions')return null;const url=new URL(config.baseURL);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)return null;return {adapter,snapshot,config,signature:signature(config),url:new URL(config.baseURL.replace(/\/+$/,'')+'/models')};}catch{return null;}
  }
  function capability(provider,model,snapshotCaps=caps,desc=descriptor(provider),blocked=errors){
    const record=snapshotCaps.get(provider);return desc&&record?.signature===desc.signature&&!blocked.has(provider)?record.models.find(item=>item.id===model&&item.fast):null;
  }
  function view(session,provider,model){const desc=descriptor(provider),error=errors.get(provider),record=caps.get(provider),entry=capability(provider,model);return {enabled:true,compatible:!!desc,supported:!!entry,mode:preferences.get(key(session,provider,model))||'inherit',status:pending.has(provider)?'loading':error?'error':record?.signature===desc?.signature?'ready':'unknown',error:error||null,updatedAt:record?.at||null,result:results.get(key(session,provider,model))||null};}
  function announce(provider,session){if(!alive)return;for(const client of clients)if((!provider||client.provider===provider)&&(!session||client.session===session)){if(!client.response.destroyed&&!client.response.writableEnded)client.response.write('data: '+JSON.stringify(view(client.session,client.provider,client.model))+'\n\n');}}
  function attachWaiter(job,signal){const token={};job.waiters.add(token);const remove=()=>{job.waiters.delete(token);if(!job.waiters.size)job.controller.abort();};signal.addEventListener('abort',remove,{once:true});if(signal.aborted)remove();return job.promise.finally(()=>{signal.removeEventListener('abort',remove);job.waiters.delete(token);});}
  function refresh(provider,signal,force=false){
    if(!alive)return Promise.reject(fail(503,'STOPPED'));if(storeError)return Promise.reject(storeError);
    const desc=descriptor(provider);if(!desc)return Promise.resolve();
    if(!force&&checked.get(provider)===desc.signature)return Promise.resolve();
    const existing=pending.get(provider);if(existing){if(existing.signature===desc.signature&&!existing.controller.signal.aborted)return attachWaiter(existing,signal);existing.controller.abort();}
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000),job={controller,signature:desc.signature,waiters:new Set(),promise:null};pending.set(provider,job);
    job.promise=(async()=>{try{
      const apiKey=await desc.adapter.config.resolveApiKey(provider,desc.config);controller.signal.throwIfAborted();
      const headers=new Headers(desc.config.headers||{});headers.set('accept','application/json');if(apiKey)headers.set('authorization','Bearer '+apiKey);
      const response=await fetch(desc.url,{headers,signal:controller.signal,redirect:'error'});if(!response.ok){await response.body?.cancel();throw fail(response.status===401||response.status===403?response.status:502,'CAPABILITY_HTTP_'+response.status);}
      const raw=await boundedJSON(response,controller.signal);if(!Array.isArray(raw?.data))throw fail(502,'INVALID_CAPABILITIES');
      const models=[],seen=new Set();for(const item of raw.data){if(!plain(item)||!idOK(item.id)||seen.has(item.id))continue;seen.add(item.id);const tiers=item.capabilities?.service_tiers;models.push({id:item.id,fast:Array.isArray(tiers)&&tiers.some(tier=>['priority','fast'].includes(tier))&&(!item.routing||item.routing==='direct')});}
      if(models.length>8192)throw fail(413,'CATALOG_TOO_LARGE');
      if(!alive||controller.signal.aborted||descriptor(provider)?.signature!==desc.signature)return;
      await serial(file,()=>{if(!alive||controller.signal.aborted)return;const previous=caps.get(provider);caps.set(provider,{provider,signature:desc.signature,at:Date.now(),models});try{persist();}catch(error){if(previous)caps.set(provider,previous);else caps.delete(provider);throw error;}errors.delete(provider);checked.set(provider,desc.signature);});
    }catch(error){if(alive&&!controller.signal.aborted&&descriptor(provider)?.signature===desc.signature){errors.set(provider,error.status?error.message:'CAPABILITY_UNAVAILABLE');checked.set(provider,desc.signature);}}
    finally{clearTimeout(timer);if(pending.get(provider)===job){pending.delete(provider);announce(provider);}}})();
    announce(provider);return attachWaiter(job,signal);
  }
  function modesFor(session){return new Map([...preferences].filter(([id])=>JSON.parse(id)[0]===session).map(([id,mode])=>{const [,provider,model]=JSON.parse(id);return [pair(provider,model),mode];}));}
  function snapshotFor(session,turn){
    let inherited;const agents=runtimeCtx?.get('agents');if(agents?.isOwnedBy)for(const [parent,value] of turns){const agent=agents.get(parent);if(agent&&agents.isOwnedBy(session,agent)){inherited=value;break;}}
    return {turn,modes:new Map([...(inherited?.modes||[]),...modesFor(session)]),caps:new Map(inherited?.caps||caps),blocked:new Set(inherited?.blocked||errors.keys())};
  }
  function statusUpdate(result){if(!alive||results.get(result.key)!==result)return;announce(result.provider,result.session);}
  function metadata(result,raw){
    const generation=raw?.gateway?.generation;if(!plain(generation)&&!raw?.service_tier)return;
    const requested=generation?.requested_service_tier,actual=generation?.actual_service_tier||raw.service_tier;
    let changed=false;for(const [name,value] of [['requested',requested],['actual',actual]])if(typeof value==='string'&&['priority','fast','default','auto'].includes(value)&&!(name==='actual'&&value==='auto'&&['priority','fast','default'].includes(result.actual))&&result[name]!==value){result[name]=value;changed=true;}
    const confirmed=actual==='default'?false:generation?.fast_confirmed;
    if(typeof confirmed==='boolean'&&(confirmed||['priority','fast','default'].includes(actual))&&result.confirmed!==confirmed){result.confirmed=confirmed;changed=true;}
    if(changed)statusUpdate(result);
  }
  function observeFetch(base,result){return async function(input,init){
    const response=await base(input,init);if(!alive||!response.ok||!response.body||!response.headers.get('content-type')?.includes('text/event-stream'))return response;
    let buffer='',discard=false;const decoder=new TextDecoder();
    function inspect(text){buffer+=text;while(true){const match=/\r?\n\r?\n/.exec(buffer);if(!match){if(buffer.length>128*1024){buffer='';discard=true;}return;}const event=buffer.slice(0,match.index);buffer=buffer.slice(match.index+match[0].length);if(discard||event.length>128*1024){discard=false;continue;}const json=event.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');if(json&&json!=='[DONE]')try{metadata(result,JSON.parse(json));}catch{} }}
    const transformed=response.body.pipeThrough(new TransformStream({transform(chunk,controller){if(alive)inspect(decoder.decode(chunk,{stream:true}));controller.enqueue(chunk);},flush(){buffer='';}}));
    return new Response(transformed,{status:response.status,statusText:response.statusText,headers:response.headers});
  };}
  function hook(adapter){
    if(wrappers.has(adapter)||typeof adapter.current!=='function'||typeof adapter.streamWithSnapshot!=='function'||typeof adapter.config?.resolveApiKey!=='function')return;
    const original=adapter.streamWithSnapshot,property=Object.getOwnPropertyDescriptor(adapter,'streamWithSnapshot');
    const wrapper=async function*(options,snapshot){
      if(!alive){yield* original.call(this,options,snapshot);return;}
      const session=options.sessionId,desc=descriptor(options.provider,snapshot,this),turn=turns.get(session),recordCaps=turn?.caps||caps,cap=capability(options.provider,options.model,recordCaps,desc,turn?.blocked||errors),mode=turn?.modes.get(pair(options.provider,options.model))||(!turn&&preferences.get(key(session,options.provider,options.model)))||'inherit';
      if(!desc||!session||!cap){if(desc&&session&&mode!=='inherit')throw fail(409,'该模型速度能力不可用，请重新读取能力。 / Model speed capabilities unavailable; refresh them.');yield* original.call(this,options,snapshot);return;}
      const result={key:key(session,options.provider,options.model),id:randomUUID(),session,provider:options.provider,model:options.model,turn:turn?.turn??null,mode,requested:mode==='fast'?'priority':mode==='standard'?'default':null,actual:null,confirmed:false,status:'running'};results.set(result.key,result);if(results.size>200)results.delete(results.keys().next().value);statusUpdate(result);
      const tier=mode==='fast'?'priority':mode==='standard'?'default':undefined,models=snapshot.models;
      const proxy=new Proxy(models,{get(target,prop){if(prop==='streamSimple')return (model,context,opts)=>{
        const safeModel={...model,headers:cleanHeaders(model.headers)};
        return target.streamSimple(safeModel,context,{...opts,transformHeaders:async headers=>{const previous=opts.transformHeaders?await opts.transformHeaders(headers):headers;return {...cleanHeaders(previous),...tier?{'X-Home-AI-Service-Tier':tier}:{}};},onPayload:async(payload,requestModel)=>{const previous=await opts.onPayload?.(payload,requestModel),next={...(previous??payload)};delete next.service_tier;if(tier)next.service_tier=tier;return next;},fetch:observeFetch(opts.fetch||globalThis.fetch,result)});
      };const value=Reflect.get(target,prop,target);return typeof value==='function'?value.bind(target):value;}});
      try{for await(const chunk of original.call(this,options,{...snapshot,models:proxy})){if(chunk.type==='finish'){result.status=chunk.reason.kind==='error'?'error':chunk.reason.kind==='aborted'?'aborted':'complete';statusUpdate(result);}yield chunk;}}
      catch(error){result.status=options.signal?.aborted?'aborted':'error';statusUpdate(result);throw error;}
      finally{if(result.status==='running'){result.status=options.signal?.aborted?'aborted':'unconfirmed';statusUpdate(result);}}
    };
    Object.defineProperty(adapter,'streamWithSnapshot',{configurable:true,writable:true,value:wrapper});wrappers.set(adapter,()=>{if(adapter.streamWithSnapshot===wrapper){if(property)Object.defineProperty(adapter,'streamWithSnapshot',property);else delete adapter.streamWithSnapshot;}});
  }
  ctx.inject(['llm','sessions','agents'],scope=>{runtimeCtx=scope;runtime=scope.get('llm')[ORIGINAL]||scope.get('llm');const install=()=>{if(!alive)return;const current=new Set();for(const provider of runtime.listProviders())try{const adapter=runtime.registration(provider.id).adapter;current.add(adapter);hook(adapter);}catch{}for(const [adapter,restore] of wrappers)if(!current.has(adapter)){restore();wrappers.delete(adapter);}};install();scope.on('llm/adapters-updated',()=>{checked.clear();install();announce();for(const client of clients)void refresh(client.provider,client.signal).catch(()=>{});});scope.effect(()=>()=>{runtime=null;runtimeCtx=null;for(const restore of wrappers.values())restore();wrappers.clear();});});
  ctx.on('session/event',(session,event)=>{if(!alive)return;if(event.type==='turn/start')turns.set(session.id,snapshotFor(session.id,event.data.turn));if(event.type==='turn/end'){for(const result of results.values())if(result.session===session.id&&result.turn===event.data.turn&&['error','aborted'].includes(event.data.reason?.kind)){result.status=event.data.reason.kind;statusUpdate(result);}turns.delete(session.id);}});
  ctx.on('agent/disposed',({agent})=>{if(agent?.id)turns.delete(agent.id);});
  ctx.inject(['webServer','connection'],host=>host.effect(()=>host.webServer.register({name:'tanuki-toolbox.gateway-speed',kind:'exact',path:'/tanuki-toolbox/gateway-speed',async handler(request,response){
    let refused=403;try{refused=host.get('connection')?.requestRejection(request);}catch{}if(refused!==undefined){response.writeHead(403);response.end();return;}
    const send=(status,value)=>{if(!response.destroyed&&!response.writableEnded){response.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});response.end(JSON.stringify(value));}};
    if(!alive){send(503,{error:'STOPPED'});return;}if(!['GET','POST','PATCH'].includes(request.method)){send(405,{error:'METHOD_NOT_ALLOWED'});return;}if(request.method!=='GET'&&!sameOrigin(request)){send(403,{error:'BAD_ORIGIN'});return;}
    const controller=new AbortController();controllers.add(controller);let client=null;const close=()=>{controller.abort();controllers.delete(controller);if(client)clients.delete(client);};response.once('close',close);
    try{
      if(storeError)throw storeError;const query=new URL(request.url,'http://localhost').searchParams,provider=query.get('provider'),model=query.get('model')||'',session=query.get('session')||'';if(!idOK(provider)||model&&!idOK(model)||session&&!idOK(session))throw fail(400,'INVALID_SELECTION');
      if(request.method==='POST'){await refresh(provider,controller.signal,true);controller.signal.throwIfAborted();send(200,view(session,provider,model));return;}
      if(request.method==='PATCH'){
        const patch=JSON.parse((await body(request,controller.signal,4096)).toString('utf8'));if(!session||!model||!plain(patch)||Object.keys(patch).join()!=='mode'||!['inherit','standard','fast'].includes(patch.mode))throw fail(400,'INVALID_SPEED');if(!runtimeCtx?.get('sessions')?.get(session))throw fail(404,'SESSION_NOT_FOUND');
        if(patch.mode!=='inherit'&&!capability(provider,model))throw fail(409,'SPEED_NOT_ADVERTISED');
        await serial(file,()=>{if(!alive||controller.signal.aborted)throw fail(503,'STOPPED');const id=key(session,provider,model),previous=preferences.get(id);if(patch.mode==='inherit')preferences.delete(id);else preferences.set(id,patch.mode);try{persist();}catch(error){if(previous)preferences.set(id,previous);else preferences.delete(id);throw error;}});send(200,view(session,provider,model));announce(provider,session);return;
      }
      if(query.get('listen')==='1'&&session&&model){response.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store','x-content-type-options':'nosniff'});response.flushHeaders?.();client={response,provider,model,session,signal:controller.signal};clients.add(client);response.write('data: '+JSON.stringify(view(session,provider,model))+'\n\n');await refresh(provider,controller.signal);if(!controller.signal.aborted)await new Promise(resolve=>controller.signal.addEventListener('abort',resolve,{once:true}));return;}
      send(200,view(session,provider,model));
    }catch(error){if(!response.headersSent)send(error.status||503,{error:error.status?error.message:'SPEED_UNAVAILABLE'});else if(!response.destroyed)response.end();}finally{if(!client){response.off('close',close);close();}}
  }})));
  ctx.effect(()=>()=>{alive=false;for(const job of pending.values())job.controller.abort();pending.clear();for(const controller of controllers)controller.abort();controllers.clear();for(const client of clients)client.response.end();clients.clear();for(const restore of wrappers.values())restore();wrappers.clear();turns.clear();results.clear();caps.clear();preferences.clear();});
}
module.exports={register};
