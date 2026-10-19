'use strict';
// Toolbox default behavior, deliberately independent of component switches.
// No discovery, background polling, provider configuration edits, or API calls on startup.
const fs = require('node:fs');
const path = require('node:path');
const { sameOrigin, body, save, serial } = require('./toolbox-settings.cjs').protocol;
const ORIGINAL = Symbol.for('cordis.original');
const LIMIT = 2 * 1024 * 1024;
const idOK = value => typeof value === 'string' && value.length > 0 && value.length <= 1024 && !/[\x00-\x1f\x7f]/.test(value);
const key = (provider, model) => JSON.stringify([provider, model]);
const fail = (status, message) => Object.assign(new Error(message), { status });
function read(file) {
  let value;
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > LIMIT) throw fail(503, 'INVALID_MODEL_POLICY');
    value = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) { if (error.code === 'ENOENT') return new Set(); throw error; }
  if (!value || value.schema !== 1 || Object.keys(value).some(k => !['schema', 'disabled'].includes(k)) || !Array.isArray(value.disabled) || value.disabled.length > 8192) throw fail(503, 'INVALID_MODEL_POLICY');
  const disabled = new Set();
  for (const pair of value.disabled) {
    if (!Array.isArray(pair) || pair.length !== 2 || !pair.every(idOK)) throw fail(503, 'INVALID_MODEL_POLICY');
    disabled.add(key(...pair));
  }
  return disabled;
}
function register(ctx, profile) {
  const file = path.join(profile.dir, '.tanuki-toolbox', 'model-policy.json');
  let disabled, storeError, stopped = false, runtime = null;
  try { disabled = read(file); } catch (error) { disabled = new Set(); storeError = error; }
  function assertAllowed(config) {
    if (storeError) throw Object.assign(new Error('无法读取模型屏蔽设置 / Model policy is unavailable. Open Settings → Models.'), { code: 'TANUKI_MODEL_POLICY_UNAVAILABLE' });
    if (disabled.has(key(config.provider, config.model))) throw Object.assign(new Error('该模型已禁用。请在设置 → 模型中重新启用或选择其他模型。 / This model is disabled. Enable it in Settings → Models or choose another model. (' + config.provider + ' / ' + config.model + ')'), { code: 'TANUKI_MODEL_DISABLED' });
  }
  const state = () => ({ schema: 1, disabled: [...disabled].map(value => JSON.parse(value)) });
  function announce() {
    // Native clients invalidate their model directories on this existing event.
    // No composition rewrite: changing a model switch does not reload plugins/UI.
    try { runtime?.llm.emitAdaptersUpdated(); } catch (error) { ctx.logger.warn('tanuki: model catalog invalidation failed', error); }
  }
  ctx.inject(['llm'], scope => {
    const llm = scope.get('llm'), target = llm[ORIGINAL] || llm;
    const originals = Object.fromEntries(['listModels', 'prepareCall', 'forAdapter'].map(name => [name, { descriptor: Object.getOwnPropertyDescriptor(target, name), method: target[name] }]));
    if (Object.values(originals).some(entry => typeof entry.method !== 'function')) throw new Error('Tanuki: unsupported LLM policy interface');
    const owner = { llm, list: provider => originals.listModels.method.call(llm, provider) };
    // Only wrap the live service instance, never its prototype or third-party adapters.
    const listModels = async function(provider) {
      const models = await originals.listModels.method.call(this, provider);
      if (storeError) throw fail(503, 'MODEL_POLICY_UNAVAILABLE');
      return models.filter(model => !disabled.has(key(provider, model.id)));
    };
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
      Object.defineProperty(target, 'prepareCall', { configurable: true, writable: true, value: prepareCall });
      Object.defineProperty(target, 'forAdapter', { configurable: true, writable: true, value: forAdapter });
      runtime = owner; announce();
      return () => {
        if (runtime === owner) runtime = null;
        for (const [name, wrapper] of Object.entries({ listModels, prepareCall, forAdapter })) if (target[name] === wrapper) {
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
            const data = JSON.parse((await body(request, controller.signal, 8192)).toString('utf8'));
            if (!data || Object.keys(data).length !== 3 || !['provider', 'model', 'enabled'].every(k => Object.hasOwn(data, k)) || !idOK(data.provider) || !idOK(data.model) || typeof data.enabled !== 'boolean') throw fail(400, 'INVALID_MODEL_SWITCH');
            await serial(file, () => {
              if (stopped || controller.signal.aborted) throw fail(499, 'ABORTED');
              // Re-read within the transaction to preserve another window's saved switches.
              const next = read(file), entry = key(data.provider, data.model);
              if (data.enabled) next.delete(entry); else next.add(entry);
              const value = { schema: 1, disabled: [...next].map(item => JSON.parse(item)) };
              if (next.size > 8192 || Buffer.byteLength(JSON.stringify(value)) > LIMIT) throw fail(413, 'TOO_MANY_MODELS');
              save(file, value); disabled = next; announce();
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
                  groups[index] = { id: provider.id, name: provider.name, models: models.map(model => ({ id: model.id, name: model.name })) };
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
  ctx.effect(() => () => { stopped = true; disabled.clear(); });
}
module.exports = { register };
