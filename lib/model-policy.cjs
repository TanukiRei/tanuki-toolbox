'use strict';
// Toolbox default behavior, deliberately independent of component switches.
// No discovery, background polling, provider configuration edits, or API calls on startup.
const fs = require('node:fs');
const path = require('node:path');
const { sameOrigin, body, save, serial } = require('./toolbox-settings.cjs').protocol;
const ORIGINAL = Symbol.for('cordis.original');
const LIMIT = 2 * 1024 * 1024;
const idOK = value => typeof value === 'string' && value.length > 0 && value.length <= 1024 && !/[\x00-\x1f\x7f]/.test(value);
const selectionOK=value=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(name=>['provider','model','reasoningEffort'].includes(name))&&idOK(value.provider)&&idOK(value.model)&&(value.reasoningEffort===undefined||idOK(value.reasoningEffort));
const orderOK = value => Array.isArray(value) && value.length <= 8192 && value.every(idOK) && new Set(value).size === value.length;
const ordersOK = value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length <= 1024 && Object.entries(value).every(([id, order]) => idOK(id) && orderOK(order));
const ordered = (rows, order, getId) => { const positions = new Map(order.map((id, index) => [id, index])); return rows.map((row, index) => ({row,index})).sort((a,b) => (positions.get(getId(a.row)) ?? order.length+a.index) - (positions.get(getId(b.row)) ?? order.length+b.index)).map(item=>item.row); };
const key = (provider, model) => JSON.stringify([provider, model]);
const fail = (status, message) => Object.assign(new Error(message), { status });
function read(file) {
  let value;
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > LIMIT) throw fail(503, 'INVALID_MODEL_POLICY');
    value = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) { if (error.code === 'ENOENT') return {disabled:new Set(),disabledProviders:new Set(),providerOrder:[],modelOrder:{},pinnedDefault:null}; throw error; }
  if (!value || value.schema !== 1 || Object.keys(value).some(k => !['schema', 'disabled', 'disabledProviders', 'providerOrder', 'modelOrder','defaultSelection'].includes(k)) || !Array.isArray(value.disabled) || value.disabled.length > 8192 || value.disabledProviders!==undefined&&(!Array.isArray(value.disabledProviders)||value.disabledProviders.length>1024||!value.disabledProviders.every(idOK)) || value.providerOrder!==undefined&&!orderOK(value.providerOrder) || value.modelOrder!==undefined&&!ordersOK(value.modelOrder) || value.defaultSelection!==undefined&&!selectionOK(value.defaultSelection)) throw fail(503, 'INVALID_MODEL_POLICY');
  const disabled = new Set();
  for (const pair of value.disabled) {
    if (!Array.isArray(pair) || pair.length !== 2 || !pair.every(idOK)) throw fail(503, 'INVALID_MODEL_POLICY');
    disabled.add(key(...pair));
  }
  return {disabled,disabledProviders:new Set(value.disabledProviders||[]),providerOrder:value.providerOrder||[],modelOrder:value.modelOrder||{},pinnedDefault:value.defaultSelection||null};
}
function register(ctx, profile) {
  const file = path.join(profile.dir, '.tanuki-toolbox', 'model-policy.json');
  let disabled, disabledProviders, providerOrder=[], modelOrder={}, pinnedDefault=null, defaultModel=null, savingDefault=false, storeError, stopped = false, runtime = null;
  try { ({disabled,disabledProviders,providerOrder,modelOrder,pinnedDefault} = read(file)); } catch (error) { disabled = new Set(); disabledProviders = new Set(); storeError = error; }
  ctx.inject(['agentDefaultModel'],scope=>{
    const service=scope.get('agentDefaultModel'),target=service[ORIGINAL]||service,readMethod=target.currentSelection,saveMethod=target.saveSelection;
    if(typeof readMethod!=='function'||typeof saveMethod!=='function')return;
    const readDescriptor=Object.getOwnPropertyDescriptor(target,'currentSelection'),saveDescriptor=Object.getOwnPropertyDescriptor(target,'saveSelection');
    const owner={read:()=>readMethod.call(service),save:value=>saveMethod.call(service,value)};
    // Session model selection normally changes DSH's global default as a side
    // effect. Once Settings pins a default, keep session changes session-local.
    const currentSelection=function(){return pinnedDefault?{...pinnedDefault}:readMethod.call(this);};
    const saveSelection=function(value){return pinnedDefault||savingDefault?Promise.resolve():saveMethod.call(this,value);};
    scope.effect(()=>{defaultModel=owner;Object.defineProperty(target,'currentSelection',{configurable:true,writable:true,value:currentSelection});Object.defineProperty(target,'saveSelection',{configurable:true,writable:true,value:saveSelection});return()=>{if(defaultModel===owner)defaultModel=null;for(const [name,wrapper,descriptor] of [['currentSelection',currentSelection,readDescriptor],['saveSelection',saveSelection,saveDescriptor]])if(target[name]===wrapper){if(descriptor)Object.defineProperty(target,name,descriptor);else delete target[name];}};});
  });
  function assertAllowed(config) {
    if (storeError) throw Object.assign(new Error('无法读取模型屏蔽设置 / Model policy is unavailable. Open Settings → Models.'), { code: 'TANUKI_MODEL_POLICY_UNAVAILABLE' });
    if (disabledProviders.has(config.provider)||disabled.has(key(config.provider, config.model))) throw Object.assign(new Error('该模型已禁用。请在设置 → 模型中重新启用或选择其他模型。 / This model is disabled. Enable it in Settings → Models or choose another model. (' + config.provider + ' / ' + config.model + ')'), { code: 'TANUKI_MODEL_DISABLED' });
  }
  const encode=next=>({schema:1,disabled:[...next.disabled].map(item=>JSON.parse(item)),disabledProviders:[...next.disabledProviders],providerOrder:next.providerOrder,modelOrder:next.modelOrder,...next.pinnedDefault?{defaultSelection:next.pinnedDefault}:{}});
  const state = () => ({ schema: 1, disabled: [...disabled].map(value => JSON.parse(value)), disabledProviders:[...disabledProviders],providerOrder,modelOrder,defaultSelection:pinnedDefault||defaultModel?.read()||null });
  function announce() {
    // Native clients invalidate their model directories on this existing event.
    // No composition rewrite: changing a model switch does not reload plugins/UI.
    try { runtime?.llm.emitAdaptersUpdated(); } catch (error) { ctx.logger.warn('tanuki: model catalog invalidation failed', error); }
  }
  ctx.inject(['llm'], scope => {
    const llm = scope.get('llm'), target = llm[ORIGINAL] || llm;
    const originals = Object.fromEntries(['listProviders', 'listModels', 'prepareCall', 'forAdapter'].map(name => [name, { descriptor: Object.getOwnPropertyDescriptor(target, name), method: target[name] }]));
    if (Object.values(originals).some(entry => typeof entry.method !== 'function')) throw new Error('Tanuki: unsupported LLM policy interface');
    const owner = { llm, list: provider => originals.listModels.method.call(llm, provider) };
    // Only wrap the live service instance, never its prototype or third-party adapters.
    const listModels = async function(provider) {
      if (storeError) throw fail(503, 'MODEL_POLICY_UNAVAILABLE');
      if (disabledProviders.has(provider)) return [];
      const models = await originals.listModels.method.call(this, provider);
      if (storeError) throw fail(503, 'MODEL_POLICY_UNAVAILABLE');
      return disabledProviders.has(provider)?[]:ordered(models.filter(model => !disabled.has(key(provider, model.id))),modelOrder[provider]||[],model=>model.id);
    };
    const listProviders=function(...args){return ordered(originals.listProviders.method.apply(this,args),providerOrder,provider=>provider.id);};
    const prepareCall = async function(config, ...args) {
      assertAllowed(config);
      const prepared = await originals.prepareCall.method.call(this, config, ...args);
      assertAllowed(prepared.config);
      // Also cover a prepared handle retained before its model was switched off.
      return Object.freeze({ ...prepared, stream(options) { assertAllowed(options); return prepared.stream(options); } });
    };
    const forAdapter = function(options, ...args) {
      // Native adapterStream calls this synchronously immediately before dispatch.
      // Re-check after asynchronous model preparation: a switch may have changed meanwhile.
      assertAllowed(options);
      return originals.forAdapter.method.call(this, options, ...args);
    };
    scope.effect(() => {
      Object.defineProperty(target, 'listModels', { configurable: true, writable: true, value: listModels });
      Object.defineProperty(target, 'listProviders', { configurable: true, writable: true, value: listProviders });
      Object.defineProperty(target, 'prepareCall', { configurable: true, writable: true, value: prepareCall });
      Object.defineProperty(target, 'forAdapter', { configurable: true, writable: true, value: forAdapter });
      runtime = owner; announce();
      return () => {
        if (runtime === owner) runtime = null;
        for (const [name, wrapper] of Object.entries({ listProviders, listModels, prepareCall, forAdapter })) if (target[name] === wrapper) {
          const { descriptor } = originals[name];
          if (descriptor) Object.defineProperty(target, name, descriptor); else delete target[name];
        }
        try { llm.emitAdaptersUpdated(); } catch {}
      };
    });
    // Official waterfall is the final guard for direct streams and stale/default selections.
    // Throwing refuses dispatch without synthesizing a retryable provider failure.
    scope.on('llm/stream', (options, next) => { assertAllowed(options); return next(); }, { prepend: true });
  });
  ctx.inject(['webServer', 'connection'], host => {
    const active = new Map();
    host.effect(() => () => { for (const [controller, send] of active) { controller.abort(); send(503, { error: 'STOPPED' }); } active.clear(); });
    host.effect(() => host.webServer.register({
      name: 'tanuki-toolbox.model-policy', kind: 'exact', path: '/tanuki-toolbox/model-policy',
      async handler(request, response) {
        const send = (status, value) => {
          if (response.destroyed || response.writableEnded) return;
          response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
          response.end(JSON.stringify(value));
        };
        let refusal = 403;
        try { const connection = host.get('connection'); if (typeof connection?.requestRejection === 'function') refusal = connection.requestRejection(request); } catch {}
        if (refusal !== undefined) { send(403, { error: 'UNAUTHORIZED' }); return; }
        if (stopped) { send(503, { error: 'STOPPED' }); return; }
        if (!['GET', 'PATCH'].includes(request.method)) { send(405, { error: 'METHOD_NOT_ALLOWED' }); return; }
        if (request.method === 'PATCH' && !sameOrigin(request)) { send(403, { error: 'BAD_ORIGIN' }); return; }
        const controller = new AbortController(), close = () => { if (!response.writableEnded) controller.abort(); };
        active.set(controller, send); response.once('close', close);
        try {
          if (storeError) throw fail(503, 'MODEL_POLICY_UNAVAILABLE');
          if (request.method === 'PATCH') {
            const data = JSON.parse((await body(request, controller.signal, 256*1024)).toString('utf8'));
            const exact=names=>data&&typeof data==='object'&&!Array.isArray(data)&&Object.keys(data).length===names.length&&names.every(name=>Object.hasOwn(data,name));
            if(exact(['defaultSelection'])){
              const selection=data.defaultSelection,owner=runtime,service=defaultModel;
              if(!selectionOK(selection))throw fail(400,'INVALID_DEFAULT_MODEL');
              if(!owner||!service)throw fail(503,'DEFAULT_MODEL_UNAVAILABLE');assertAllowed(selection);
              if(!(await owner.list(selection.provider)).some(model=>model.id===selection.model))throw fail(400,'MODEL_UNAVAILABLE');
              if(stopped||controller.signal.aborted)throw fail(499,'ABORTED');assertAllowed(selection);
              await serial(file,async()=>{if(stopped||controller.signal.aborted)throw fail(499,'ABORTED');savingDefault=true;try{
                await service.save(selection);const current=service.read();
                if(current.provider!==selection.provider||current.model!==selection.model||current.reasoningEffort!==selection.reasoningEffort)throw fail(503,'DEFAULT_MODEL_NOT_SAVED');
                const next=read(file);next.pinnedDefault={...selection};const encoded=encode(next);if(Buffer.byteLength(JSON.stringify(encoded))>LIMIT)throw fail(413,'TOO_MANY_MODELS');save(file,encoded);({disabled,disabledProviders,providerOrder,modelOrder,pinnedDefault}=next);
              }finally{savingDefault=false;}});
              announce();send(200,state());return;
            }
            if(exact(['providerOrder'])||exact(['provider','modelOrder'])){
              if(exact(['providerOrder'])?!orderOK(data.providerOrder):!idOK(data.provider)||!orderOK(data.modelOrder))throw fail(400,'INVALID_MODEL_ORDER');
              await serial(file,()=>{if(stopped||controller.signal.aborted)throw fail(499,'ABORTED');const next=read(file);if(data.providerOrder)next.providerOrder=data.providerOrder;else next.modelOrder={...next.modelOrder,[data.provider]:data.modelOrder};const value=encode(next);if(!ordersOK(next.modelOrder)||Buffer.byteLength(JSON.stringify(value))>LIMIT)throw fail(413,'TOO_MANY_MODELS');save(file,value);({disabled,disabledProviders,providerOrder,modelOrder,pinnedDefault}=next);announce();});send(200,state());return;
            }
            const providerSwitch=data&&Object.keys(data).length===2&&Object.hasOwn(data,'provider')&&Object.hasOwn(data,'enabled');
            if (!data || !(providerSwitch||Object.keys(data).length===3&&['provider','model','enabled'].every(k=>Object.hasOwn(data,k))) || !idOK(data.provider) || !providerSwitch&&!idOK(data.model) || typeof data.enabled !== 'boolean') throw fail(400, 'INVALID_MODEL_SWITCH');
            await serial(file, () => {
              if (stopped || controller.signal.aborted) throw fail(499, 'ABORTED');
              // Re-read within the transaction to preserve another window's saved switches.
              const next = read(file), collection=providerSwitch?next.disabledProviders:next.disabled, entry=providerSwitch?data.provider:key(data.provider,data.model);
              if (data.enabled) collection.delete(entry); else collection.add(entry);
              const value = encode(next);
              if (next.disabled.size > 8192 || next.disabledProviders.size>1024 || Buffer.byteLength(JSON.stringify(value)) > LIMIT) throw fail(413, 'TOO_MANY_MODELS');
              save(file, value); ({disabled,disabledProviders,providerOrder,modelOrder,pinnedDefault}=next); announce();
            });
            send(200, state());
          } else if (new URL(request.url, 'http://localhost').searchParams.get('catalog') === '1') {
            const owner = runtime;
            if (!owner) throw fail(503, 'MODEL_SERVICE_UNAVAILABLE');
            const providers = owner.llm.listProviders(), groups = [], failures = [];
            // Read raw metadata ONLY on explicit access to Settings → Models.
            let cursor = 0;
            await Promise.all(Array.from({ length: Math.min(3, providers.length) }, async () => {
              while (cursor < providers.length) {
                if (stopped || controller.signal.aborted || runtime !== owner) return;
                const index = cursor++, provider = providers[index];
                try {
                  const models = await owner.list(provider.id);
                  if (stopped || controller.signal.aborted || runtime !== owner) return;
                  groups[index] = { id: provider.id, name: provider.name, models: models.map(model => ({ id: model.id, name: model.name,...Object.fromEntries(['contextWindow','maxTokens','inputModalities','reasoning'].filter(field=>model[field]!==undefined).map(field=>[field,model[field]])) })) };
                } catch { failures[index] = { id: provider.id, name: provider.name }; }
              }
            }));
            if (!controller.signal.aborted && runtime === owner && !stopped) send(200, { ...state(), groups: groups.filter(Boolean), failures: failures.filter(Boolean) });
            else send(503, { error: 'MODEL_SERVICE_CHANGED' });
          } else send(200, state());
        } catch (error) {
          send(error.status || (error instanceof SyntaxError ? 400 : 503), { error: error.status ? error.message : 'MODEL_POLICY_UNAVAILABLE' });
        } finally { response.off('close', close); active.delete(controller); }
      }
    }));
  });
  ctx.effect(() => () => { stopped = true; disabled.clear(); disabledProviders.clear(); providerOrder=[]; modelOrder={}; pinnedDefault=null; });
}
module.exports = { register };
