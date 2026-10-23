export const name='tanuki-rules';
import state from '../../lib/component-state.cjs';
export function apply(ctx){
  const profile=ctx.get('profileContext');if(!profile?.dir)return;
  let alive=true,epoch=0,child=null,closing=Promise.resolve();
  function stop(){const previous=child;child=null;if(previous)closing=Promise.resolve(previous.dispose());return closing;}
  async function sync(){const current=++epoch,enabled=await state.enabled(profile,'tanuki-rules');if(!alive||current!==epoch)return;if(enabled===false){await stop();return;}if(child)return;await closing;const {default:rules}=await import('../../lib/rules-runtime.cjs');if(alive&&current===epoch)child=ctx.plugin({name:'tanuki-rules-host',apply:scope=>rules.register(scope,profile)});}
  ctx.on('plugin-manager/changed',()=>void sync().catch(error=>{if(alive)ctx.logger.warn('[Tanuki] Rules state unavailable',error);}));
  ctx.effect(()=>()=>{alive=false;++epoch;return stop();});return sync();
}
