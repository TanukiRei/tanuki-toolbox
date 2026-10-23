export const name='tanuki-recycle-bin';
export async function apply(ctx){let alive=true;ctx.effect(()=>()=>{alive=false;});const profile=ctx.get('profileContext');if(!profile?.dir)return;const {default:bin}=await import('../../lib/recycle-bin.cjs');if(alive)bin.register(ctx,profile);}
