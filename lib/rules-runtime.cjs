'use strict';
const {createRequire}=require('node:module'),{pathToFileURL}=require('node:url');
const store=require('./rules-store.cjs'),{sameOrigin,body}=require('./toolbox-settings.cjs').protocol;
const ORIGINAL=Symbol.for('cordis.original');
async function register(ctx,profile){
  let alive=true,windows=null,injectionReady=false,estimator=null;const streams=new Map(),requests=new Set(),lastSent=new Map(),heartbeats=new Set(),formal=new Map(),applied=new Map();
  ctx.on('tanuki/recycle-purging',async id=>{await windows?.close(id);applied.delete(id);lastSent.delete(id);});
  ctx.effect(()=>()=>{alive=false;const closing=windows?.dispose();for(const controller of requests)controller.abort();requests.clear();for(const timer of heartbeats)clearInterval(timer);heartbeats.clear();for(const group of streams.values())for(const response of group){try{response.write('data: {"disabled":true}\n\n');response.end();}catch{}}streams.clear();lastSent.clear();return closing;});
  const moduleUrl=pathToFileURL(createRequire(profile.installAnchor).resolve('@deepseek-ai/dsh-llm')).href;
  const loader=ctx.get('loader')?.internal;
  // Use the same module job as native plugins. CJS dynamic imports and the
  // host loader may otherwise own distinct process-local request WeakSets.
  const api=loader?await loader.import(moduleUrl,pathToFileURL(profile.installAnchor).href,{}):await import(moduleUrl);
  if(!alive||ctx.fiber.uid===null)return;
  function snapshot(id){return {...store.read(profile,id),injectionReady,appliedRevision:applied.get(id)||null,detached:windows?.has(id)===true,desktopSupported:process.platform==='win32'};}
  function publish(id,extra={}){if(!alive)return;const value={...snapshot(id),...extra};for(const response of streams.get(id)||[])if(!response.destroyed&&!response.writableEnded)response.write('data: '+JSON.stringify(value)+'\n\n');}
  async function update(id,text,revision,check){const value=await store.write(profile,id,text,revision,check);if(alive){publish(id);windows?.state(id,value);}return value;}
  const isOwn=message=>typeof message?.id==='string'&&message.id.startsWith('tanuki-rules-');
  const estimate=(message,meter)=>meter?.estimateMessage?meter.estimateMessage(message):Math.ceil(message.content[0].text.length/3)+8;
  // Public agent events establish dispatch provenance even if another plugin
  // clones the envelope and loses the host's private identity marker.
  ctx.on('agent/request',async({agent,signal},next)=>{if(alive&&store.validId(agent?.id)){formal.set(agent.id,signal);await windows?.flush(agent.id,signal);if(!injectionReady&&store.message(store.read(profile,agent.id)))throw Error('规则注入未就绪，请重新启用规则组件。 / Rules injection is unavailable. Re-enable Rules.');}return next();},{prepend:true});
  ctx.on('session/event',(session,event)=>{if(event.type==='turn/end')formal.delete(session.id);});
  ctx.on('agent/disposed',({agent})=>{formal.delete(agent?.id);lastSent.delete(agent?.id);applied.delete(agent?.id);});
  ctx.effect(()=>()=>{injectionReady=false;estimator=null;formal.clear();applied.clear();});
  ctx.inject(['sessionController'],scope=>{
    const service=scope.get('sessionController'),controller=service[ORIGINAL]||service,target=controller.commands;
    if(typeof target?.fork!=='function')throw Error('Rules: unsupported session fork boundary');
    const original=target.fork,descriptor=Object.getOwnPropertyDescriptor(target,'fork');
    async function fork(request){if(!alive||!store.validId(request?.sessionId))return original.call(this,request);await windows?.flush(request.sessionId);const snapshot=store.read(profile,request.sessionId);const result=await original.call(this,request);if(store.validId(result?.sessionId)&&result.sessionId!==request.sessionId){await store.inherit(profile,snapshot,result.sessionId);if(alive)publish(result.sessionId);}return result;}
    scope.effect(()=>{Object.defineProperty(target,'fork',{configurable:true,writable:true,value:fork});return()=>{if(target.fork===fork){if(descriptor)Object.defineProperty(target,'fork',descriptor);else delete target.fork;}};});
  });
  ctx.inject(['tokenMeter'],scope=>{
    const service=scope.get('tokenMeter'),meter=service[ORIGINAL]||service,original=meter.measure,descriptor=Object.getOwnPropertyDescriptor(meter,'measure');
    estimator=meter;
    function measure(session,...args){const value=original.call(this,session,...args);if(!alive||!store.validId(session?.id))return value;const message=store.message(store.read(profile,session.id));if(!message)return value;const tokens=estimate(message,meter),extra=value.baseline?.kind==='usage'?Math.max(0,tokens-(lastSent.get(session.id)||0)):tokens;return Object.freeze({...value,totalTokens:value.totalTokens+extra,tanukiRulesTokens:tokens});}
    scope.effect(()=>{Object.defineProperty(meter,'measure',{configurable:true,writable:true,value:measure});return()=>{if(meter.measure===measure){if(descriptor)Object.defineProperty(meter,'measure',descriptor);else delete meter.measure;}};});
  });
  ctx.inject(['llm'],scope=>{
    const service=scope.get('llm'),llm=service[ORIGINAL]||service,original=llm.streamWithRegistration,descriptor=Object.getOwnPropertyDescriptor(llm,'streamWithRegistration');
    if(typeof original!=='function'||typeof api.isAgentLoopRequest!=='function'||typeof api.markAgentLoopRequest!=='function')throw Error('Rules: unsupported LLM dispatch boundary');
    function stream(options,prepared){
      const known=formal.has(options.sessionId)&&formal.get(options.sessionId)===options.signal&&Object.hasOwn(options,'toolHistory');
      if(!alive||options.purpose!==undefined||!store.validId(options.sessionId)||!known&&!api.isAgentLoopRequest(options))return original.call(this,options,prepared);
      const target=this,id=options.sessionId;
      return (async function*(){
        // Flush a detached editor before reading. Never publish the injected copy
        // to Session, its durable history, or the compaction source surface.
        await windows?.flush(id,options.signal);options.signal?.throwIfAborted();
        if(!alive){yield* original.call(target,options,prepared);return;}
        const state=store.read(profile,id),rule=store.message(state),base=options.messages.filter(message=>!isOwn(message));
        if(!rule&&base.length===options.messages.length){yield* original.call(target,options,prepared);return;}
        const messages=[...base];let at=0;while(messages[at]?.role==='system')at++;if(rule)messages.splice(at,0,rule);
        const tokens=rule?estimate(rule,estimator):0,capacity=prepared?.modelInfo?.context?.contextWindow;
        if(rule&&Number.isFinite(capacity)&&tokens+(options.maxTokens||0)>=capacity)throw Error('规则过长，无法完整放入当前模型；请缩短规则。 / Rules do not fit this model. Shorten them; they were not truncated.');
        const request=api.markAgentLoopRequest(Object.freeze({...options,messages:Object.freeze(messages)}));let completed=false;
        applied.set(id,state.revision);if(applied.size>128)applied.delete(applied.keys().next().value);publish(id);
        for await(const chunk of original.call(target,request,prepared)){if(chunk.type==='finish'&&!['error','aborted'].includes(chunk.reason?.kind))completed=true;yield chunk;}
        if(alive&&completed){lastSent.set(id,tokens);if(lastSent.size>128)lastSent.delete(lastSent.keys().next().value);}
      })();
    }
    scope.effect(()=>{Object.defineProperty(llm,'streamWithRegistration',{configurable:true,writable:true,value:stream});injectionReady=true;for(const id of streams.keys())publish(id);return()=>{injectionReady=false;if(llm.streamWithRegistration===stream){if(descriptor)Object.defineProperty(llm,'streamWithRegistration',descriptor);else delete llm.streamWithRegistration;}};});
  });
  ctx.inject(['webServer','connection'],host=>host.effect(()=>host.webServer.register({name:'tanuki-toolbox.rules',kind:'exact',path:'/tanuki-toolbox/rules',async handler(request,response){
    let refusal=403;try{refusal=host.get('connection')?.requestRejection(request);}catch{}if(refusal!==undefined){response.writeHead(403);response.end();return;}
    const send=(status,value)=>{if(!response.destroyed&&!response.writableEnded){response.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});response.end(JSON.stringify(value));}};
    if(!alive){send(503,{error:'STOPPED'});return;}if(!['GET','PUT','POST'].includes(request.method)){send(405,{error:'METHOD_NOT_ALLOWED'});return;}if(request.method!=='GET'&&!sameOrigin(request)){send(403,{error:'BAD_ORIGIN'});return;}
    const controller=new AbortController();requests.add(controller);let watch=null,heartbeat=null;
    const close=()=>{controller.abort();requests.delete(controller);if(watch){const group=streams.get(watch);group?.delete(response);if(!group?.size)streams.delete(watch);}clearInterval(heartbeat);heartbeats.delete(heartbeat);};response.once('close',close);
    const check=()=>{if(!alive||controller.signal.aborted)throw store.fail(499,'ABORTED');};
    try{
      const query=new URL(request.url,'http://localhost').searchParams,id=query.get('session');if(!store.validId(id))throw store.fail(400,'INVALID_SESSION');
      if(request.method==='GET'){
        const current=snapshot(id);check();
        if(query.get('watch')==='1'){
          if([...streams.values()].reduce((n,set)=>n+set.size,0)>=16)throw store.fail(429,'TOO_MANY_RULE_VIEWS');
          response.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store','x-accel-buffering':'no'});response.flushHeaders?.();
          watch=id;if(!streams.has(id))streams.set(id,new Set());streams.get(id).add(response);response.write('data: '+JSON.stringify(current)+'\n\n');heartbeat=setInterval(()=>{if(alive&&!response.destroyed)response.write(': rules\n\n');},25000);heartbeats.add(heartbeat);return;
        }
        send(200,current);return;
      }
      if(!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type']||''))throw store.fail(415,'JSON_REQUIRED');
      const value=JSON.parse((await body(request,controller.signal,256*1024)).toString('utf8'));check();
      if(request.method==='PUT'){await update(id,value.rows??value.text,value.revision,check);send(200,snapshot(id));return;}
      if(!windows)windows=require('./rules-window.cjs').create(profile,{
        read:snapshot,
        update:async(session,rows)=>update(session,rows,undefined,()=>{if(!alive)throw store.fail(499,'STOPPED');}),
        changed:(session,extra)=>{if(alive)publish(session,extra);}
      });
      if(value.action==='detach'){
        if(process.platform!=='win32')throw store.fail(409,'NATIVE_UNSUPPORTED');
        await windows.open(id,value.theme||{},value.language==='zh'?'zh':'en',value.motion);check();publish(id);send(200,snapshot(id));return;
      }
      if(value.action==='focus'){windows.focus(id);send(200,snapshot(id));return;}
      if(value.action==='attach'){await windows.close(id);check();publish(id,{returnToPanel:true});send(200,snapshot(id));return;}
      if(value.action==='theme'){windows.theme(id,value.theme||{},value.language==='zh'?'zh':'en');send(200,snapshot(id));return;}
      throw store.fail(400,'INVALID_ACTION');
    }catch(error){send(error.status||503,{error:error.code||'RULES_UNAVAILABLE',...error.current?{current:error.current}:{}});}
    finally{if(!watch){response.off('close',close);requests.delete(controller);}}
  }})));
}
module.exports={register};
