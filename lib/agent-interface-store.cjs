'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {save,serial}=require('./toolbox-settings.cjs').protocol;
const fail=(status,code)=>Object.assign(new Error(code),{status,code});
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function directory(profile){const dir=path.join(profile.dir,'.tanuki-toolbox','agent-interface');fs.mkdirSync(dir,{recursive:true,mode:0o700});if(!fs.lstatSync(dir).isDirectory()||fs.lstatSync(dir).isSymbolicLink())throw fail(503,'INVALID_DIRECTORY');return dir;}
function read(file,limit=65536){const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>limit)throw fail(503,'INVALID_STORE');return JSON.parse(fs.readFileSync(file,'utf8'));}
function credentials(profile){const file=path.join(directory(profile),'connection.json');try{const value=read(file);if(value.schema!==1||!/^tki_[a-f0-9]{64}$/.test(value.key)||!Number.isInteger(value.port)||value.port<0||value.port>65535)throw fail(503,'INVALID_CONNECTION');return value;}catch(error){if(error.code!=='ENOENT')throw error;const value={schema:1,key:'tki_'+crypto.randomBytes(32).toString('hex'),port:0};save(file,value);return value;}}
function authorized(actual,expected){if(typeof actual!=='string')return false;const a=Buffer.from(actual),b=Buffer.from(expected);return a.length===b.length&&crypto.timingSafeEqual(a,b);}
function trim(dir,session){const files=fs.readdirSync(dir).filter(name=>/^[a-f0-9-]{36}\.json$/.test(name)).map(name=>({file:path.join(dir,name),time:fs.statSync(path.join(dir,name)).mtimeMs})).sort((a,b)=>b.time-a.time);for(const item of files.slice(200))try{const value=read(item.file,512*1024);if(value.state!=='running'||value.session!==session)fs.unlinkSync(item.file);}catch{}}
module.exports={directory,read,credentials,authorized,save,serial,uuid,fail,trim};
