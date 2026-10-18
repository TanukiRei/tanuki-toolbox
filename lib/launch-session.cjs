'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const KEY='TANUKI_PROTECTED_SESSION';
function prepareLaunch(env,result){
  const next={...env};delete next[KEY];
  if(result?.status!=='checked'||result.mode!=='preflight')return {env:next};
  const token=crypto.randomUUID();next[KEY]=token;return {env:next,token};
}
function recordLaunch(profile,token,appPid,result){
  if(!token)return;
  const dir=path.join(profile,'.tanuki-toolbox');fs.mkdirSync(dir,{recursive:true});
  const value={schema:1,token,appPid,profile:path.resolve(profile),at:new Date().toISOString(),checked:result.checked,disabled:result.disabled?.length||0,unknown:result.unknown?.length||0};
  const temp=path.join(dir,'launch-session-'+process.pid+'.tmp');
  fs.writeFileSync(temp,JSON.stringify(value,null,2));fs.renameSync(temp,path.join(dir,'launch-session.json'));
}
function readLaunchSession(profile,env=process.env,parentPid=process.ppid){
  const token=env[KEY];if(!token)return {status:'ordinary'};
  try{
    const value=JSON.parse(fs.readFileSync(path.join(profile,'.tanuki-toolbox','launch-session.json'),'utf8'));
    if(value.schema!==1||value.token!==token||value.appPid!==parentPid||path.resolve(value.profile).toLowerCase()!==path.resolve(profile).toLowerCase()||!Number.isFinite(Date.parse(value.at)))return {status:'unconfirmed'};
    return {status:'protected',at:value.at,checked:value.checked,disabled:value.disabled,unknown:value.unknown};
  }catch{return {status:'unconfirmed'};}
}
module.exports={prepareLaunch,recordLaunch,readLaunchSession};
