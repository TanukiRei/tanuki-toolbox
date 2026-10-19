export const name = 'tanuki-home';
export async function apply(ctx) {
  let stopped=false;ctx.effect(()=>()=>{stopped=true;});
  const {default:data}=await import('../../lib/home-data.cjs');
  if(!stopped)data.register(ctx);
}
