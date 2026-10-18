'use strict';
function register(ctx,routes){
  ctx.inject(['webServer','connection'],host=>{
    let stopped=false;const active=new Map();
    host.effect(()=>()=>{stopped=true;for(const [controller,response] of active){controller.abort();if(!response.writableEnded&&!response.destroyed){response.writeHead(503);response.end();}}active.clear();});
    for(const [route,read] of Object.entries(routes))host.effect(()=>host.webServer.register({
      name:'tanuki-toolbox.'+route,kind:'exact',path:'/tanuki-toolbox/'+route,
      async handler(request,response){
        const connection=host.get('connection');let refusal=403;
        try{if(typeof connection?.requestRejection==='function')refusal=connection.requestRejection(request);}catch{}
        if(refusal!==undefined){response.writeHead(refusal);response.end();return;}
        if(request.method!=='GET'){response.writeHead(405);response.end();return;}
        if(stopped){response.writeHead(503);response.end();return;}
        const controller=new AbortController(),close=()=>{if(!response.writableEnded)controller.abort();};
        active.set(controller,response);response.once('close',close);
        try{
          const body=await read(controller.signal);
          if(!stopped&&!controller.signal.aborted&&!response.destroyed){response.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});response.end(JSON.stringify(body));}
        }catch{
          if(!stopped&&!controller.signal.aborted&&!response.destroyed){response.writeHead(503,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});response.end(JSON.stringify({error:'SOURCE_UNAVAILABLE'}));}
        }finally{response.off('close',close);active.delete(controller);}
      }
    }));
  });
}
module.exports={register};
