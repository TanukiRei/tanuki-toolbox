'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const validName=name=>typeof name==='string'&&name.length<=214&&/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i.test(name);
const clean=value=>Array.from(value.replace(/[\u0000-\u001f\u007f]/g,' ').trim()).slice(0,120).join('');
function read(file){
  let data;
  try{if(fs.statSync(file).size>1024*1024)throw new Error('Alias file too large');data=JSON.parse(fs.readFileSync(file,'utf8'));}
  catch(error){if(error.code==='ENOENT')return Object.create(null);throw error;}
  if(data?.schema!==1||!data.aliases||Array.isArray(data.aliases)||typeof data.aliases!=='object')throw new Error('Invalid alias file');
  const aliases=Object.create(null);
  for(const [name,value] of Object.entries(data.aliases))if(validName(name)&&typeof value==='string'&&clean(value))aliases[name]=clean(value);
  return aliases;
}
function register(ctx,profile){
  const directory=path.join(profile.dir,'.tanuki-toolbox'),file=path.join(directory,'plugin-aliases.json');
  ctx.inject(['webServer','connection'],host=>{
    let stopped=false;const pending=new Set();
    host.effect(()=>()=>{stopped=true;for(const cancel of pending)cancel();pending.clear();});
    host.effect(()=>host.webServer.register({
      name:'tanuki-toolbox.plugin-aliases',kind:'exact',path:'/tanuki-toolbox/plugin-aliases',
      async handler(request,response){
        const connection=host.get('connection');let refusal=403;
        try{if(typeof connection?.requestRejection==='function')refusal=connection.requestRejection(request);}catch{}
        const send=(status,body)=>{if(!response.destroyed&&!response.writableEnded){response.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});response.end(JSON.stringify(body));}};
        if(refusal!==undefined){send(refusal,{error:'UNAUTHORIZED'});return;}
        if(stopped){send(503,{error:'COMPONENT_STOPPED'});return;}
        if(request.method==='GET'){try{send(200,{schema:1,aliases:read(file)});}catch{send(503,{error:'READ_FAILED'});}return;}
        if(request.method!=='PUT'){send(405,{error:'METHOD_NOT_ALLOWED'});return;}
        // JSON PUTs require same-origin authorization; no CORS/preflight is exposed.
        if(!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type']||'')||request.headers['sec-fetch-site']==='cross-site'){send(415,{error:'INVALID_REQUEST'});return;}
        let cancel,close;
        try{
          const body=await new Promise((resolve,reject)=>{
            const chunks=[];let bytes=0,done=false;
            const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);request.off('data',data);request.off('end',end);request.off('error',fail);request.off('aborted',abort);error?reject(error):resolve(value);};
            const fail=()=>finish(Object.assign(new Error('Read failed'),{status:400}));
            const abort=()=>finish(Object.assign(new Error('Aborted'),{status:499}));
            const data=chunk=>{bytes+=Buffer.byteLength(chunk);if(bytes>8192){finish(Object.assign(new Error('Too large'),{status:413}));request.resume();}else chunks.push(Buffer.from(chunk));};
            const end=()=>{try{finish(null,JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{fail();}};
            const timer=setTimeout(()=>{finish(Object.assign(new Error('Timed out'),{status:408}));request.resume();},10000);
            cancel=()=>finish(Object.assign(new Error('Stopped'),{status:503}));pending.add(cancel);
            close=()=>{if(!response.writableEnded)abort();};response.once('close',close);
            request.on('data',data);request.once('end',end);request.once('error',fail);request.once('aborted',abort);
          });
          if(stopped||request.aborted||response.destroyed){send(503,{error:'COMPONENT_STOPPED'});return;}
          if(!validName(body?.name)||typeof body?.alias!=='string'){send(400,{error:'INVALID_ALIAS'});return;}
          const alias=clean(body.alias),aliases=read(file);
          if(alias)aliases[body.name]=alias;else delete aliases[body.name];
          fs.mkdirSync(directory,{recursive:true});const temporary=path.join(directory,'plugin-aliases.'+randomUUID()+'.tmp');
          try{fs.writeFileSync(temporary,JSON.stringify({schema:1,aliases},null,2)+'\n','utf8');fs.renameSync(temporary,file);}
          finally{try{fs.unlinkSync(temporary);}catch{}}
          send(200,{schema:1,name:body.name,alias});
        }catch(error){send(error.status||503,{error:'SAVE_FAILED'});}
        finally{if(cancel)pending.delete(cancel);if(close)response.off('close',close);}
      }
    }));
  });
}
module.exports={register};
