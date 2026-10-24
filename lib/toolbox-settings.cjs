'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const LIMIT = 5 * 1024 * 1024;
// One atomic envelope keeps metadata and bytes consistent across replacement/crashes.
// Names supplied by clients are display metadata ONLY, never filesystem paths.
const queues = new Map();
const fail = (status, message) => Object.assign(new Error(message), { status });
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, expected) => plain(value) && Object.keys(value).length === expected.length && expected.every(k => Object.hasOwn(value, k));
const volumeOK = n => Number.isInteger(n) && n >= 0 && n <= 100;
const nameOK = n => typeof n === 'string' && n.length > 0 && n.length <= 255 && !/[\x00-\x1f\x7f/\\]/.test(n) && n !== '.' && n !== '..';
function magic(bytes, type) {
  if (type === 'audio/wav') return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE';
  if (type === 'audio/ogg') return bytes.length >= 27 && bytes.toString('ascii', 0, 4) === 'OggS' && bytes[4] === 0;
  if (type === 'audio/mpeg') return bytes.length >= 10 && (bytes.toString('ascii', 0, 3) === 'ID3' && bytes[3] >= 2 && bytes[3] <= 4 && bytes[4] !== 255 && [...bytes.subarray(6, 10)].every(n => n < 128) || bytes[0] === 255 && (bytes[1] & 224) === 224 && (bytes[1] & 24) !== 8 && (bytes[1] & 6) !== 0 && (bytes[2] & 240) !== 0 && (bytes[2] & 240) !== 240 && (bytes[2] & 12) !== 12);
  return false;
}
function canonicalType(value) {
  const type = String(value || '').split(';')[0].trim().toLowerCase();
  return ({ 'audio/x-wav': 'audio/wav', 'audio/wave': 'audio/wav', 'audio/mp3': 'audio/mpeg' })[type] || type;
}
const categoryNames = ['plugins', 'tasks', 'updates'];
const defaults = () => ({ plugins: true, tasks: true, updates: true });
const subset = (value, allowed) => plain(value) && Object.keys(value).every(k => allowed.includes(k));
const categoriesOK = value => subset(value, categoryNames) && Object.values(value).every(v => typeof v === 'boolean');
const composerDefaults = () => ({ timeStats: true, modelSelection: true, fileMenu: true, sessionList: true });
const composerOK = value => subset(value, ['timeStats', 'modelSelection', 'fileMenu', 'sessionList']) && Object.values(value).every(v => typeof v === 'boolean');
const enhancementsOK = value => subset(value, ['models']) && Object.values(value).every(v => typeof v === 'boolean');
function fresh() { return { schema: 1, island: { volume: 100, audio: null, categories: defaults(), bubbles: true, inApp: true, systemNotifications: false, soundEnabled: true }, composer: composerDefaults(), settingsEnhancements:{models:true}, startup:{protection:true}, audioBase64: null }; }
function publicState(state) { return { schema: 1, composer: { ...state.composer }, settingsEnhancements:{...state.settingsEnhancements}, startup:{...state.startup}, island: { volume: state.island.volume, audio: state.island.audio, categories: { ...state.island.categories }, bubbles: state.island.bubbles, inApp: state.island.inApp, systemNotifications: state.island.systemNotifications, soundEnabled: state.island.soundEnabled } }; }
function readState(file) {
  let state;
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.size > Math.ceil(LIMIT / 3) * 4 + 8192) throw fail(503, 'INVALID_STORE');
    state = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) { if (error.code === 'ENOENT') return fresh(); throw error; }
  if (!subset(state, ['schema', 'island', 'audioBase64', 'composer', 'settingsEnhancements', 'startup']) || !['schema', 'island', 'audioBase64'].every(k => Object.hasOwn(state, k)) || state.schema !== 1 || !subset(state.island, ['volume', 'audio', 'categories', 'bubbles', 'inApp', 'systemNotifications', 'soundEnabled']) || !Object.hasOwn(state.island, 'audio') || !volumeOK(state.island.volume)) throw fail(503, 'INVALID_STORE');
  if (Object.hasOwn(state, 'composer') && !composerOK(state.composer)) throw fail(503, 'INVALID_STORE');
  state.composer = { ...composerDefaults(), ...state.composer };
  if (Object.hasOwn(state,'settingsEnhancements')&&!enhancementsOK(state.settingsEnhancements)) throw fail(503,'INVALID_STORE');
  state.settingsEnhancements = {models:true,...state.settingsEnhancements};
  if (Object.hasOwn(state,'startup')&&(!subset(state.startup,['protection'])||Object.values(state.startup).some(v=>typeof v!=='boolean'))) throw fail(503,'INVALID_STORE');
  state.startup = {protection:true,...state.startup};
  if (Object.hasOwn(state.island, 'categories') && !categoriesOK(state.island.categories) || Object.hasOwn(state.island, 'bubbles') && typeof state.island.bubbles !== 'boolean' || ['inApp', 'systemNotifications', 'soundEnabled'].some(k => Object.hasOwn(state.island, k) && typeof state.island[k] !== 'boolean')) throw fail(503, 'INVALID_STORE');
  // Existing schema-1 volume/audio are preserved; absent new preferences receive defaults.
  state.island.categories = { ...defaults(), ...state.island.categories };
  state.island.bubbles = state.island.bubbles ?? true;
  state.island.inApp = state.island.inApp ?? true;
  state.island.systemNotifications = state.island.systemNotifications ?? false;
  state.island.soundEnabled = state.island.soundEnabled ?? true;
  const audio = state.island.audio;
  if (audio === null) { if (state.audioBase64 !== null) throw fail(503, 'INVALID_STORE'); }
  else {
    if (!keys(audio, ['revision', 'name', 'type', 'size']) || !/^[0-9a-f-]{36}$/.test(audio.revision) || !nameOK(audio.name) || !Number.isInteger(audio.size) || audio.size < 1 || audio.size > LIMIT || typeof state.audioBase64 !== 'string') throw fail(503, 'INVALID_STORE');
    const bytes = Buffer.from(state.audioBase64, 'base64');
    if (bytes.length !== audio.size || bytes.toString('base64') !== state.audioBase64 || !magic(bytes, audio.type)) throw fail(503, 'INVALID_STORE');
  }
  return state;
}
function save(file, state) {
  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (!fs.lstatSync(directory).isDirectory() || fs.lstatSync(directory).isSymbolicLink()) throw fail(503, 'INVALID_DIRECTORY');
  const temporary = path.join(directory, 'settings-' + randomUUID() + '.tmp');
  let fd;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(fd, JSON.stringify(state) + '\n', 'utf8');
    fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
    fs.renameSync(temporary, file);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
function serial(file, action) {
  const previous = queues.get(file) || Promise.resolve();
  const current = previous.catch(() => {}).then(action);
  queues.set(file, current);
  current.finally(() => { if (queues.get(file) === current) queues.delete(file); }).catch(() => {});
  return current;
}
function sameOrigin(request) {
  if (request.headers['x-tanuki-settings'] !== '1') return false;
  const site = request.headers['sec-fetch-site'];
  const origin = request.headers.origin;
  // Called only AFTER connection.requestRejection succeeds. The native dsh-app
  // proxy validates its origin, then strips both browser headers and supplies
  // the host-issued cookie. Keep the non-simple custom header mandatory.
  if (origin === undefined && site === undefined) return true;
  if (site !== undefined && site !== 'same-origin') return false;
  if (origin === undefined) return false;
  try {
    const expected = new URL((request.socket?.encrypted ? 'https://' : 'http://') + request.headers.host);
    const actual = new URL(origin);
    return typeof origin === 'string' && origin === actual.origin && actual.origin === expected.origin && !actual.username && !actual.password;
  } catch { return false; }
}
function body(request, signal, limit) {
  return new Promise((resolve, reject) => {
    let size = 0, done = false;
    const chunks = [];
    const finish = (error, value) => {
      if (done) return; done = true; clearTimeout(timer);
      request.off('data', data); request.off('end', end); request.off('error', errorHandler); request.off('aborted', abort);
      signal.removeEventListener('abort', abort);
      error ? reject(error) : resolve(value);
    };
    const abort = () => finish(fail(499, 'ABORTED'));
    const errorHandler = () => finish(fail(400, 'INVALID_BODY'));
    const data = chunk => {
      size += Buffer.byteLength(chunk);
      if (size > limit) { finish(fail(413, 'TOO_LARGE')); request.resume(); }
      else chunks.push(Buffer.from(chunk));
    };
    const end = () => finish(null, Buffer.concat(chunks));
    const timer = setTimeout(() => { finish(fail(408, 'BODY_TIMEOUT')); request.resume(); }, 10000);
    request.on('data', data); request.once('end', end); request.once('error', errorHandler); request.once('aborted', abort);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted || request.aborted) abort();
    else if (request.headers['content-length'] !== undefined && (!/^\d+$/.test(request.headers['content-length']) || Number(request.headers['content-length']) > limit)) { finish(fail(413, 'TOO_LARGE')); request.resume(); }
  });
}
function register(ctx, profile) {
  if (!profile || typeof profile.dir !== 'string' || !path.isAbsolute(profile.dir)) throw new TypeError('Absolute profile.dir required');
  const file = path.join(profile.dir, '.tanuki-toolbox', 'toolbox-settings.json');
  // ctx owns inject/effect disposal; no extra manual cleanup handle is needed.
  return ctx.inject(['webServer', 'connection'], host => {
    let stopped = false;
    const active = new Map();
    host.effect(() => () => {
      stopped = true;
      for (const [controller, send] of active) { controller.abort(); send(503, { error: 'COMPONENT_STOPPED' }); }
      active.clear();
    });
    for (const route of ['settings', 'audio', 'autostart']) {const audioRoute=route==='audio',autostartRoute=route==='autostart';host.effect(() => host.webServer.register({
      name: 'tanuki-toolbox.settings.' + route, kind: 'exact',
      path: autostartRoute?'/tanuki-toolbox/autostart':'/tanuki-toolbox/settings' + (audioRoute ? '/audio' : ''),
      async handler(request, response) {
        const send = (status, value, type) => {
          if (response.destroyed || response.writableEnded) return;
          const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-type': type || 'application/json; charset=utf-8' };
          response.writeHead(status, headers); response.end(type ? value : JSON.stringify(value));
        };
        let refusal = 403;
        try { const connection = host.get('connection'); if (typeof connection?.requestRejection === 'function') refusal = connection.requestRejection(request); } catch {}
        if (refusal !== undefined) { send(Number.isInteger(refusal) && refusal >= 400 && refusal <= 599 ? refusal : 403, { error: 'UNAUTHORIZED' }); return; }
        if (stopped) { send(503, { error: 'COMPONENT_STOPPED' }); return; }
        const method = request.method;
        if (!(audioRoute ? ['GET', 'PUT', 'DELETE'] : ['GET', 'PATCH']).includes(method)) { send(405, { error: 'METHOD_NOT_ALLOWED' }); return; }
        if (method !== 'GET' && !sameOrigin(request)) { send(403, { error: 'SAME_ORIGIN_REQUIRED' }); return; }
        const controller = new AbortController();
        const close = () => { if (!response.writableEnded) controller.abort(); };
        const abort = () => controller.abort();
        response.once('close', close); request.once('aborted', abort); active.set(controller, send);
        const check = () => { if (stopped || controller.signal.aborted || request.aborted || response.destroyed) throw fail(499, 'ABORTED'); };
        try {
          if(autostartRoute){
            const service=require('./autostart.cjs');check();
            if(method==='GET'){send(200,service.inspect(profile));return;}
            if(!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type']||''))throw fail(415,'JSON_REQUIRED');
            let value;try{value=JSON.parse((await body(request,controller.signal,1024)).toString('utf8'));}catch{throw fail(400,'INVALID_JSON');}
            if(!keys(value,['enabled'])||typeof value.enabled!=='boolean')throw fail(400,'INVALID_PATCH');
            const result=await service.set(profile,value.enabled,check);check();send(200,result);return;
          }
          let patch, upload, audio;
          if (method === 'PATCH') {
            if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] || '')) throw fail(415, 'JSON_REQUIRED');
            const bytes = await body(request, controller.signal, 8192);
            try { patch = JSON.parse(bytes.toString('utf8')); } catch { throw fail(400, 'INVALID_JSON'); }
            if (keys(patch, ['composer'])) {
              if (!composerOK(patch.composer) || !Object.keys(patch.composer).length) throw fail(400, 'INVALID_PATCH');
              patch.island = {};
            } else if (keys(patch,['startup'])) {
              if (!subset(patch.startup,['protection'])||typeof patch.startup.protection!=='boolean') throw fail(400,'INVALID_PATCH');
              patch.island = {};
            } else if (keys(patch,['settingsEnhancements'])) {
              if (!enhancementsOK(patch.settingsEnhancements)||!Object.keys(patch.settingsEnhancements).length) throw fail(400,'INVALID_PATCH');
              patch.island = {};
            } else if (!keys(patch, ['island']) || !subset(patch.island, ['volume', 'categories', 'bubbles', 'inApp', 'systemNotifications', 'soundEnabled']) || !Object.keys(patch.island).length) throw fail(400, 'INVALID_PATCH');
            if (Object.hasOwn(patch.island, 'volume') && !volumeOK(patch.island.volume) || Object.hasOwn(patch.island, 'categories') && (!categoriesOK(patch.island.categories) || !Object.keys(patch.island.categories).length) || Object.hasOwn(patch.island, 'bubbles') && typeof patch.island.bubbles !== 'boolean' || ['inApp', 'systemNotifications', 'soundEnabled'].some(k => Object.hasOwn(patch.island, k) && typeof patch.island[k] !== 'boolean')) throw fail(400, 'INVALID_PATCH');
          }
          if (method === 'PUT') {
            const type = canonicalType(request.headers['content-type']);
            if (!['audio/wav', 'audio/mpeg', 'audio/ogg'].includes(type)) throw fail(415, 'UNSUPPORTED_AUDIO');
            let name; try { name = decodeURIComponent(request.headers['x-audio-name']); } catch { throw fail(400, 'INVALID_NAME'); }
            if (typeof request.headers['x-audio-name'] !== 'string' || !nameOK(name)) throw fail(400, 'INVALID_NAME');
            upload = await body(request, controller.signal, LIMIT);
            if (!magic(upload, type)) throw fail(415, 'INVALID_AUDIO');
            audio = { revision: randomUUID(), name, type, size: upload.length };
          }
          await serial(file, () => {
            check();
            const state = readState(file);
            if (method === 'GET') {
              if (!audioRoute) send(200, publicState(state));
              else if (state.island.audio === null) send(404, { error: 'NO_AUDIO' });
              else send(200, Buffer.from(state.audioBase64, 'base64'), state.island.audio.type);
              return;
            }
            if (method === 'PATCH') {
              if (patch.composer) Object.assign(state.composer, patch.composer);
              if (patch.settingsEnhancements) Object.assign(state.settingsEnhancements,patch.settingsEnhancements);
              if (patch.startup) Object.assign(state.startup,patch.startup);
              if (Object.hasOwn(patch.island, 'volume')) state.island.volume = patch.island.volume;
              if (Object.hasOwn(patch.island, 'bubbles')) state.island.bubbles = patch.island.bubbles;
              for (const key of ['inApp', 'systemNotifications', 'soundEnabled']) if (Object.hasOwn(patch.island, key)) state.island[key] = patch.island[key];
              if (patch.island.categories) Object.assign(state.island.categories, patch.island.categories);
            }
            if (method === 'PUT') { state.island.audio = audio; state.audioBase64 = upload.toString('base64'); }
            if (method === 'DELETE') { state.island.audio = null; state.island.volume = 100; state.audioBase64 = null; }
            check(); save(file, state); send(200, publicState(state));
            if (patch?.startup) ctx.emit('tanuki/startup', { ...state.startup });
            if (patch?.settingsEnhancements) ctx.emit('tanuki/settings-enhancements', { ...state.settingsEnhancements });
          });
        } catch (error) { send(error.status || 503, { error: error.status ? error.message : 'STORE_UNAVAILABLE' }); }
        finally { response.off('close', close); request.off('aborted', abort); active.delete(controller); }
      }
    }));}
  });
}
function readPreferences(profile){return publicState(readState(path.join(profile.dir,'.tanuki-toolbox','toolbox-settings.json')));}
async function patchPreferences(ctx,profile,patch,check=()=>{}){
  if(!plain(patch)||Object.keys(patch).length!==1)throw fail(400,'INVALID_PATCH');
  const key=Object.keys(patch)[0],value=patch[key];
  if(!plain(value)||!Object.keys(value).length)throw fail(400,'INVALID_PATCH');
  if(key==='composer'?!composerOK(value):key==='settingsEnhancements'?!enhancementsOK(value):key==='startup'?(!keys(value,['protection'])||typeof value.protection!=='boolean'):key==='island'?(!subset(value,['volume','categories','bubbles','inApp','systemNotifications','soundEnabled'])||Object.hasOwn(value,'volume')&&!volumeOK(value.volume)||Object.hasOwn(value,'categories')&&(!categoriesOK(value.categories)||!Object.keys(value.categories).length)||['bubbles','inApp','systemNotifications','soundEnabled'].some(k=>Object.hasOwn(value,k)&&typeof value[k]!=='boolean')):true)throw fail(400,'INVALID_PATCH');
  const file=path.join(profile.dir,'.tanuki-toolbox','toolbox-settings.json');
  return serial(file,()=>{check();const state=readState(file);for(const [name,item]of Object.entries(value)){if(name==='categories')Object.assign(state.island.categories,item);else state[key][name]=item;}check();save(file,state);if(key==='startup')ctx.emit('tanuki/startup',{...state.startup});if(key==='settingsEnhancements')ctx.emit('tanuki/settings-enhancements',{...state.settingsEnhancements});ctx.emit('tanuki/settings-changed');return publicState(state);});
}
module.exports = { register, readPreferences, patchPreferences, startupEnabled: profile => readState(path.join(profile.dir, '.tanuki-toolbox', 'toolbox-settings.json')).startup.protection === true, modelsEnabled: profile => readState(path.join(profile.dir, '.tanuki-toolbox', 'toolbox-settings.json')).settingsEnhancements.models === true, protocol: { sameOrigin, body, save, serial } };
