'use strict';
const fs=require('node:fs'),path=require('node:path');
const recommended=JSON.parse(fs.readFileSync(path.join(__dirname,'../recommendations.json'),'utf8'));
const {repositoryUrl}=require('./repositories.cjs').createRepositoryTools();
// Isolate requests from the host's global fetch dispatcher. Undici versions in
// different plugins can otherwise interfere with decompression and proxy use.
const {AsyncLocalStorage}=require('node:async_hooks');
const reads=new AsyncLocalStorage();
function metadataFetch(url,options){
  const network=require('undici'),scope=reads.getStore();
  scope.signal?.throwIfAborted();
  if(!scope.dispatcher){
    const normalize=value=>value?.trim()?(/^[a-z][a-z\d+.-]*:\/\//i.test(value)?value:'http://'+value):undefined;
    const httpProxy=normalize(process.env.http_proxy||process.env.HTTP_PROXY||process.env.npm_config_proxy);
    const httpsProxy=normalize(process.env.https_proxy||process.env.HTTPS_PROXY||process.env.npm_config_https_proxy)||httpProxy;
    scope.dispatcher=httpProxy||httpsProxy?new network.EnvHttpProxyAgent({httpProxy,httpsProxy}):new network.Agent();
  }
  return network.fetch(url,{...options,dispatcher:scope.dispatcher});
}
async function remoteJson(url,optional=false){
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'||!['api.github.com','raw.githubusercontent.com','registry.npmjs.org'].includes(parsed.hostname))throw new Error('Unsupported metadata source');
  const scope=reads.getStore();scope.signal?.throwIfAborted();
  const response=await metadataFetch(url,{signal:scope.signal?AbortSignal.any([scope.signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000),redirect:'error',headers:{Accept:'application/json','User-Agent':'Tanuki-Toolbox'}});
  if(optional&&response.status===404){await response.body?.cancel();return null;}
  if(!response.ok){await response.body?.cancel();throw new Error(response.status===403||response.status===429?'GITHUB_LIMIT':'SOURCE_UNAVAILABLE');}
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024*1024)throw new Error('Metadata too large');chunks.push(Buffer.from(value));}}
  finally{await reader.cancel().catch(()=>{});}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function repositoryJson(slug,ref,file,optional=false){
  try{
    const value=await remoteJson('https://api.github.com/repos/'+slug+'/contents/'+file+'?ref='+encodeURIComponent(ref),optional);
    if(value===null)return null;
    if(value.type!=='file'||value.encoding!=='base64'||typeof value.content!=='string'||value.content.length>1500000)throw new Error('Invalid repository file');
    return JSON.parse(Buffer.from(value.content,'base64').toString('utf8'));
  }catch(error){
    try{return await remoteJson('https://raw.githubusercontent.com/'+slug+'/'+ref+'/'+file,optional);}catch{throw error;}
  }
}
function imageUrl(value,repository,ref){
  if(typeof value!=='string'||value.length>4096)return null;
  try{
    const base=repository.replace('https://github.com/','https://raw.githubusercontent.com/')+'/'+ref+'/';
    const url=new URL(value.replace(/^\.\//,''),base);
    if(url.protocol!=='https:'||url.username||url.password||!['raw.githubusercontent.com','github.com','avatars.githubusercontent.com'].includes(url.hostname))return null;
    return url.href;
  }catch{return null;}
}
function label(value,fallback){return typeof value==='string'?value.slice(0,4000):fallback;}
async function readRecommendation(entry){
  const repository=repositoryUrl(entry.repository);
  const base={repository,name:entry.packageName,title:entry.title,description:entry.description};
  if(!repository)return {...base,error:'SOURCE_UNAVAILABLE'};
  try{
    const slug=repository.slice('https://github.com/'.length),api='https://api.github.com/repos/'+slug;
    const release=await remoteJson(api+'/releases/latest',true).catch(()=>null);
    const ref=release?.tag_name||'HEAD';
    const commit=await remoteJson(api+'/commits/'+encodeURIComponent(ref));
    if(!/^[a-f0-9]{40}$/i.test(commit?.sha||''))throw new Error('Invalid commit');
    const pkg=await repositoryJson(slug,commit.sha,'package.json');
    if(pkg.name!==entry.packageName||!pkg.dsh?.bundle||typeof pkg.version!=='string')throw new Error('Not the recommended package');
    const [zh,en,npm]=await Promise.all([
      repositoryJson(slug,commit.sha,'locale/zh.json',true).catch(()=>null),
      repositoryJson(slug,commit.sha,'locale/en.json',true).catch(()=>null),
      remoteJson('https://registry.npmjs.org/'+encodeURIComponent(pkg.name)+'/'+encodeURIComponent(pkg.version),true).catch(()=>null)
    ]);
    // Install the exact version read from GitHub when npm links back to the same author repository.
    let installSpec=repository+'#'+commit.sha;
    if(npm?.version===pkg.version&&repositoryUrl(npm.repository)?.toLowerCase()===repository.toLowerCase())installSpec=pkg.name+'@'+pkg.version;
    else{
      const assets=(release?.assets||[]).filter(a=>typeof a.name==='string'&&a.name.endsWith('.tgz')&&typeof a.browser_download_url==='string'&&a.browser_download_url.startsWith(repository+'/releases/download/'));
      const archive=assets.find(a=>a.name===pkg.name+'.tgz'||a.name===pkg.name+'-'+pkg.version+'.tgz')||(assets.length===1?assets[0]:null);
      if(archive)installSpec=archive.browser_download_url;
    }
    return {...base,version:pkg.version,installSpec,commit:commit.sha,
      title:{zh:label(zh?.meta?.title,entry.title?.zh||pkg.name),en:label(en?.meta?.title,entry.title?.en||pkg.name)},
      description:{zh:label(zh?.meta?.description,entry.description?.zh||label(pkg.description,'')),en:label(en?.meta?.description,label(pkg.description,entry.description?.en||''))},
      icon:imageUrl(pkg.icon,repository,commit.sha)||`https://github.com/${slug.split('/')[0]}.png?size=96`};
  }catch(error){return {...base,error:error.message==='GITHUB_LIMIT'?'GITHUB_LIMIT':'SOURCE_UNAVAILABLE'};}
}
async function readRecommendations(signal){
  const scope={signal,dispatcher:null};
  return reads.run(scope,async()=>{
    try{signal?.throwIfAborted();const plugins=await Promise.all(recommended.map(readRecommendation));signal?.throwIfAborted();return {plugins};}
    finally{await scope.dispatcher?.destroy();scope.dispatcher=null;}
  });
}
async function readRepositories(profile,signal){
  signal?.throwIfAborted();
  const {createRequire}=require('node:module'),{pathToFileURL}=require('node:url');
  let boot;try{boot=await import(pathToFileURL(createRequire(profile.installAnchor).resolve('@deepseek-ai/dsh-app-boot')).href);}catch{}
  const manifest=JSON.parse(fs.readFileSync(path.join(profile.dir,'package.json'),'utf8'));
  const specs={...manifest.dependencies},names=new Set([...Object.keys(specs),...(manifest.dsh?.profile?.bundles||[])]);
  const repositories=Object.create(null);
  for(const name of names){
    signal?.throwIfAborted();
    if(typeof name!=='string'||!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i.test(name))continue;
    const source=repositoryUrl(specs[name]);if(source){repositories[name]=source;continue;}
    let pkg;try{pkg=JSON.parse(fs.readFileSync(path.join(profile.dir,'node_modules',name,'package.json'),'utf8'));}catch{}
    if(!pkg&&boot)try{pkg=JSON.parse(fs.readFileSync(path.join(boot.resolveBundleDir('tanuki',name,profile.installAnchor,profile.dir),'package.json'),'utf8'));}catch{}
    const repository=repositoryUrl(pkg?.repository)||repositoryUrl(pkg?.homepage);
    if(repository)repositories[name]=repository;
  }
  return {repositories,specs};
}
module.exports={readRecommendations,readRepositories};
