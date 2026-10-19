export const name = 'tanuki-settings-enhancements';
import settings from '../../lib/toolbox-settings.cjs';
export function apply(ctx) {
  const profile=ctx.get('profileContext');if(!profile?.dir)return;
  let alive=true,epoch=0,child=null;
  async function sync(){
    const current=++epoch;
    if(!settings.modelsEnabled(profile)){child?.dispose();child=null;return;}
    if(child)return;
    const {default:speed}=await import('../../lib/gateway-speed.cjs');
    if(alive&&epoch===current)child=ctx.plugin({name:'tanuki-gateway-speed',apply:scope=>speed.register(scope,profile)});
  }
  ctx.on('tanuki/settings-enhancements',()=>void sync().catch(error=>ctx.logger.warn('tanuki: model speed unavailable',error)));
  ctx.effect(()=>()=>{alive=false;++epoch;child?.dispose();child=null;});
  return sync();
}
