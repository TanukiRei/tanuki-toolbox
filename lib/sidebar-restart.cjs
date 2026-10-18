'use strict';
const {probe,restart}=require('../launcher/restart-controller.cjs');
const validId=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function apply(ctx){
  let stopped=false;const reads=new Set();
  ctx.inject(['webServer','connection'],host=>{
    host.effect(()=>host.webServer.register({name:'tanuki-toolbox.restart',kind:'exact',path:'/tanuki-toolbox/restart',async handler(request,response){
      const json=(status,value)=>{if(response.destroyed||response.writableEnded)return;response.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});response.end(JSON.stringify(value));};
      let refusal=403;try{const connection=host.get('connection');if(typeof connection?.requestRejection==='function')refusal=connection.requestRejection(request);}catch{}
      if(refusal!==undefined){json(refusal,{code:'FORBIDDEN'});return;}
      if(stopped){json(503,{available:false,code:'UNAVAILABLE'});return;}
      if(request.method==='GET'){
        const controller=new AbortController(),close=()=>{if(!response.writableEnded)controller.abort();};reads.add(controller);response.once('close',close);
        try{const result=await probe(controller.signal);if(!stopped&&!controller.signal.aborted)json(200,{available:result.available===true,code:result.code||'UNAVAILABLE',protocol:1});else json(503,{available:false,code:'UNAVAILABLE',protocol:1});}catch{json(stopped?503:200,{available:false,code:stopped?'UNAVAILABLE':'HOST_UNAVAILABLE',protocol:1});}finally{reads.delete(controller);response.off('close',close);}return;
      }
      if(request.method!=='POST'){json(405,{code:'METHOD_NOT_ALLOWED'});return;}
      // Require a non-simple request, in addition to the host's connection gate.
      const origin=request.headers.origin;
      let sameOrigin=true;if(origin){try{const url=new URL(origin);sameOrigin=['http:','https:'].includes(url.protocol)&&url.host===request.headers.host;}catch{sameOrigin=false;}}
      if(!sameOrigin||request.headers['sec-fetch-site']==='cross-site'||request.headers['x-tanuki-restart']!=='1'||request.headers['content-type']?.split(';')[0].trim()!=='application/json'){json(403,{status:'failed',code:'FORBIDDEN'});return;}
      let body;try{let raw='';for await(const part of request){raw+=part;if(raw.length>1024)throw new Error();}body=JSON.parse(raw);}catch{json(400,{status:'failed',code:'INVALID_REQUEST'});return;}
      if(!validId.test(body?.requestId)||body.confirmed!==true){json(400,{status:'failed',code:'INVALID_REQUEST'});return;}
      if(stopped){json(503,{status:'unavailable',code:'UNAVAILABLE',requestId:body.requestId});return;}
      // Never automatically retry a mutation after loss of its acknowledgement.
      try{const result=await restart(body.requestId.toLowerCase());json(result.status==='busy'?409:result.status==='unavailable'?503:200,result);}catch{json(503,{status:'unknown',code:'HOST_CONNECTION_LOST',requestId:body.requestId});}
    }}));
  });
  return ()=>{stopped=true;for(const controller of reads)controller.abort();reads.clear();};
}
module.exports={apply};
