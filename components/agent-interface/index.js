export const name='tanuki-agent-interface';
import state from '../../lib/component-state.cjs';
export function apply(ctx){
  const profile=ctx.get('profileContext');if(!profile?.dir)return;
  let alive=true,epoch=0,child=null,closing=Promise.resolve();
  function stop(){const previous=child;child=null;if(previous)closing=Promise.resolve(previous.dispose());return closing;}
  async function sync(){const current=++epoch,enabled=await state.enabled(profile,'tanuki-agent-interface');if(!alive||current!==epoch)return;if(enabled!==true){await stop();return;}if(child)return;await closing;if(!alive||current!==epoch)return;const {default:api}=await import('../../lib/agent-interface.cjs');if(alive&&current===epoch){child=ctx.plugin({name:'tanuki-agent-interface-host',apply:scope=>api.register(scope,profile)});await child;}}
  ctx.on('plugin-manager/changed',()=>void sync().catch(()=>{if(alive)ctx.logger.warn('[Tanuki] Agent interface state unavailable');}));
  ctx.effect(()=>()=>{alive=false;++epoch;return stop();});return sync();
}
