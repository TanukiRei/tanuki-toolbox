'use strict';
// Loaded by Message Center only. No desktop probing or child process at startup.
function register(ctx){
  let stopped=false,flight=null,last=0,lastResult={status:'unavailable'};
  ctx.effect(()=>()=>{stopped=true;});
  ctx.inject(['webServer','connection'],host=>{
    host.effect(()=>host.webServer.register({name:'tanuki-toolbox.notification-activate',kind:'exact',path:'/tanuki-toolbox/notifications/activate',async handler(request,response){
      const json=(status,value)=>{if(response.destroyed||response.writableEnded)return;response.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});response.end(JSON.stringify(value));};
      let refusal=403;try{const connection=host.get('connection');if(typeof connection?.requestRejection==='function')refusal=connection.requestRejection(request);}catch{}
      if(refusal!==undefined){json(refusal,{status:'unavailable'});return;}
      if(request.method!=='POST'){json(405,{status:'unavailable'});return;}
      const origin=request.headers.origin;
      let validOrigin=!origin||origin==='dsh-app://app';
      if(origin&&!validOrigin)try{const url=new URL(origin);validOrigin=['http:','https:'].includes(url.protocol)&&url.host===request.headers.host;}catch{}
      if(!validOrigin||request.headers['sec-fetch-site']==='cross-site'||request.headers['x-tanuki-notification-click']!=='1'){json(403,{status:'unavailable'});return;}
      if(stopped){json(503,{status:'unavailable'});return;}
      // This endpoint has no caller-controlled URL, executable, arguments or PID.
      if(!flight&&Date.now()-last>=1200){last=Date.now();flight=activate().then(result=>(lastResult=result)).catch(()=>(lastResult={status:'unavailable'})).finally(()=>{flight=null;});}
      const result=flight?await flight:lastResult;
      if(!stopped)json(result.status==='requested'?200:503,result);else json(503,{status:'unavailable'});
    }}));
  });
}
async function activate(){
  const path=require('node:path'),fs=require('node:fs');
  const executable=process.execPath,basename=path.basename(executable).toLowerCase();
  const desktopHost=process.argv.some(arg=>/[\\/]@deepseek-ai[\\/]dsh-desktop-host[\\/]lib[\\/]index\.js$/.test(arg));
  if(!desktopHost||!['win32','darwin'].includes(process.platform))return {status:'unavailable'};
  const root=path.dirname(executable);
  if(process.platform==='win32'&&(basename!=='deepseek harness.exe'||!fs.existsSync(path.join(root,'resources','app.asar'))))return {status:'unavailable'};
  if(process.platform==='darwin'&&(!/\.app[\\/]Contents[\\/]MacOS[\\/]/.test(executable)||!fs.existsSync(path.join(root,'..','Resources','app.asar'))))return {status:'unavailable'};
  const environment={...process.env};for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','NODE_PATH','ELECTRON_NO_ATTACH_CONSOLE','DSH_DESKTOP_OPEN_DEVTOOLS'])delete environment[key];
  // The installed DSH shell takes its single-instance lock before profile startup.
  // A second launch only asks the current owner to restore/show/focus its window.
  return new Promise(resolve=>{
    let done=false,timer;const finish=status=>{if(done)return;done=true;clearTimeout(timer);resolve({status});};
    try{
      // Launch Services activates an existing macOS app (including its Dock
      // instance); executing the Mach-O binary directly can leave it backgrounded.
      const command=process.platform==='darwin'?'/usr/bin/open':executable;
      const args=process.platform==='darwin'?['-a',path.resolve(root,'..','..')]:[];
      const child=require('node:child_process').spawn(command,args,{cwd:root,env:environment,stdio:'ignore',windowsHide:true});
      child.once('error',()=>finish('unavailable'));
      child.once('exit',code=>finish(code===0?'requested':'unavailable'));
      timer=setTimeout(()=>{child.unref();finish('unavailable');},7000);
    }catch{finish('unavailable');}
  });
}
module.exports={register};
