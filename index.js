import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import routes from './lib/read-routes.cjs';
import settings from './lib/toolbox-settings.cjs';
import modelPolicy from './lib/model-policy.cjs';
import componentState from './lib/component-state.cjs';
export const name = 'tanuki-toolbox';
export function apply(ctx) {
  const profile=ctx.get('profileContext'),root=dirname(fileURLToPath(import.meta.url));
  if(!profile?.dir)return;
  const version=JSON.parse(readFileSync(join(root,'package.json'),'utf8')).version;
  routes.register(ctx,{
    'component-state':async()=>({rules:await componentState.enabled(profile,'tanuki-rules')}),
    runtime:()=>{let version=null;try{const value=JSON.parse(readFileSync(profile.installAnchor,'utf8')).version;if(typeof value==='string'&&value.length<100)version=value;}catch{}return {version};},
    status:()=>{
      let report={status:'pending',disabled:[]},shortcuts={status:'pending',managed:0,warnings:[]};
      try{report=JSON.parse(readFileSync(join(profile.dir,'.tanuki-toolbox','status.json'),'utf8'));}catch{}
      if(process.platform==='win32'){try{shortcuts=JSON.parse(readFileSync(join(profile.dir,'.tanuki-toolbox','shortcut-status.json'),'utf8'));}catch{}}
      else shortcuts={status:'unsupported',managed:0,warnings:[]};
      return {...report,shortcuts};
    },
    recommendations:async signal=>(await import('./lib/recommendations.cjs')).default.readRecommendations(signal),
    repositories:async signal=>{signal.throwIfAborted();return (await import('./lib/recommendations.cjs')).default.readRepositories(profile,signal);}
  });
  settings.register(ctx,profile);
  modelPolicy.register(ctx,profile);
  const assets=Object.fromEntries(['plugin-center','home','dynamic-island','sidebar','toolbox-details','guard-settings','toolbox-settings','model-settings','model-policy','global-bubbles','composer','composer-clock','composer-model','composer-files','system-settings','settings-window','settings-enhancements','settings-models','gateway-speed','rules','composer-list','recycle-bin','agent-interface','agent-interface-events'].map(name=>[name+'.js',{file:join(root,'client-chunks',name+'.js'),type:'text/javascript; charset=utf-8'}]));
  assets['toolbox.png']={file:join(root,'assets/toolbox.png'),type:'image/png'};
  ctx.inject(['webServer', 'connection'], host => {
    for(const [name,asset] of Object.entries(assets))host.effect(() => host.webServer.register({
      name:'tanuki-toolbox.asset.'+name, kind:'exact', path:'/tanuki-toolbox/assets/'+name,
      handler(request, response) {
        const connection = host.get('connection');
        const gate = connection?.requestRejection;
        let refusal = 403;
        try { if (typeof gate === 'function') refusal = gate.call(connection, request); } catch {}
        if (refusal !== undefined) { response.writeHead(refusal); response.end(); return; }
        if (request.method !== 'GET') { response.writeHead(405); response.end(); return; }
        try{
          const body=readFileSync(asset.file);
          response.writeHead(200, { 'content-type':asset.type, 'cache-control':'no-store','x-content-type-options':'nosniff','x-tanuki-version':version });
          response.end(body);
        }catch{
          response.writeHead(503);response.end();
        }
      }
    }));
  });
}
