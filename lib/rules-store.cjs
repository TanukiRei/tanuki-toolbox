'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash,randomUUID}=require('node:crypto');
const {save,serial}=require('./toolbox-settings.cjs').protocol;
const MAX_CHARS=32768,MAX_LINES=512;
function fail(status,message){return Object.assign(new Error(message),{status,code:message});}
const validId=id=>typeof id==='string'&&id.length>0&&id.length<=256&&/^[-\w.:@]+$/u.test(id);
function normalize(text){if(typeof text!=='string')throw fail(400,'INVALID_RULES');const value=text.replace(/\r\n?/g,'\n');if(value.length>MAX_CHARS||value.split('\n').length>MAX_LINES||value.includes('\0'))throw fail(413,'RULES_TOO_LONG');return value;}
function normalizeRows(rows){if(!Array.isArray(rows)||!rows.length||rows.length>MAX_LINES)throw fail(413,'RULES_TOO_LONG');const ids=new Set();const result=rows.map(row=>{if(!row||typeof row.id!=='string'||!/^[-\w.:]{1,128}$/.test(row.id)||ids.has(row.id)||typeof row.text!=='string'||/[\r\n\0]/.test(row.text)||typeof row.enabled!=='boolean')throw fail(400,'INVALID_RULES');ids.add(row.id);return {id:row.id,text:row.text,enabled:row.enabled};});normalize(result.map(row=>row.text).join('\n'));return result;}
const legacy=(text,seed='')=>normalize(text).split('\n').map((text,index)=>({id:'rule-'+createHash('sha256').update(seed+':'+index).digest('hex').slice(0,24),text,enabled:true}));
const summarize=state=>({...state,text:state.rows.map(row=>row.text).join('\n'),count:state.rows.filter(row=>row.text.trim()).length,activeCount:state.rows.filter(row=>row.enabled&&row.text.trim()).length});
function filename(profile,id){if(!validId(id))throw fail(400,'INVALID_SESSION');return path.join(profile.dir,'.tanuki-toolbox','rules',createHash('sha256').update(id).digest('hex')+'.json');}
function directory(file){const parent=path.dirname(file);fs.mkdirSync(parent,{recursive:true});const stat=fs.lstatSync(parent);if(!stat.isDirectory()||stat.isSymbolicLink())throw fail(503,'INVALID_RULES_DIRECTORY');}
function read(profile,id){
  const file=filename(profile,id);let data;
  try{const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>512*1024)throw fail(503,'INVALID_RULES_FILE');data=JSON.parse(fs.readFileSync(file,'utf8'));}
  catch(error){if(error.code==='ENOENT')return summarize({schema:2,sessionId:id,rows:legacy('','empty:'+id),revision:null});throw fail(503,'RULES_READ_FAILED');}
  if(![1,2].includes(data.schema)||data.sessionId!==id||typeof data.revision!=='string')throw fail(503,'RULES_READ_FAILED');
  const rows=data.schema===1?legacy(data.text,data.revision):normalizeRows(data.rows);return summarize({schema:2,sessionId:id,rows,revision:data.revision,updatedAt:data.updatedAt});
}
async function write(profile,id,value,revision,check=()=>{}){
  const file=filename(profile,id);
  return serial(file,()=>{check();directory(file);const before=read(profile,id);const rows=typeof value==='string'?legacy(value,randomUUID()):normalizeRows(value);
    if(revision!==undefined&&revision!==before.revision)throw Object.assign(fail(409,'RULES_CONFLICT'),{current:before});
    if(JSON.stringify(before.rows)===JSON.stringify(rows))return before;
    const state={schema:2,sessionId:id,rows,revision:randomUUID(),updatedAt:new Date().toISOString()};check();save(file,state);return summarize(state);
  });
}
async function inherit(profile,source,target,check=()=>{}){const file=filename(profile,target);return serial(file,()=>{check();directory(file);const existing=read(profile,target);if(existing.revision!==null)return existing;const rows=normalizeRows(source.rows).map(row=>({...row}));const state={schema:2,sessionId:target,rows,revision:randomUUID(),updatedAt:new Date().toISOString()};check();save(file,state);return summarize(state);});}
function message(state){const text=state.rows.filter(row=>row.enabled).map(row=>row.text.trim()).filter(Boolean).join('\n');if(!text)return null;return Object.freeze({id:'tanuki-rules-'+state.revision,role:'system',source:Object.freeze({kind:'system-prompt'}),content:Object.freeze([Object.freeze({type:'text',text:'Current per-task rules supplied by the user. This is the complete current version and replaces earlier preferences from the Rules component. Earlier conversation describes history; follow these current preferences while respecting the existing system, tool, and permission requirements.\n<current-task-rules>\n'+text+'\n</current-task-rules>'})])});}
module.exports={read,write,inherit,message,normalize,normalizeRows,validId,fail,MAX_CHARS,MAX_LINES};
