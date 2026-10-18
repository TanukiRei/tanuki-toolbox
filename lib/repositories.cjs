'use strict';
// Shared by the local metadata reader and the browser. Catalog matching supplies
// links only; update targets always remain under the Market's public update API.
function createRepositoryTools(){
  function repositoryUrl(value){
    if(value&&typeof value==='object')value=value.url;
    if(typeof value!=='string')return null;
    value=value.trim().replace(/^git\+/i,'').replace(/^git@github\.com:/i,'https://github.com/').replace(/^ssh:\/\/git@github\.com\//i,'https://github.com/').replace(/^github:/i,'https://github.com/');
    if(/^[\w.-]+\/[\w.-]+(?:#.*)?$/.test(value))value='https://github.com/'+value;
    // Region proxies prefix the original archive URL. Extract its repository,
    // never the proxy itself, and never use the result as an installation target.
    const nested=value.match(/https:\/\/(?:github\.com|codeload\.github\.com|api\.github\.com)\/[^\s]+/i);
    if(nested)value=nested[0];
    try{
      const url=new URL(value);let parts=url.pathname.split('/').filter(Boolean);
      if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
      if(url.hostname==='api.github.com'){if(parts.shift()!=='repos')return null;}
      else if(!['github.com','codeload.github.com'].includes(url.hostname))return null;
      if(parts.length<2)return null;
      parts=parts.slice(0,2);parts[1]=parts[1].replace(/\.git$/i,'');
      if(!parts.every(p=>/^[\w.-]+$/.test(p)&&p!=='.'&&p!=='..'))return null;
      return 'https://github.com/'+parts.join('/');
    }catch{return null;}
  }
  function resolveRepositories(names,local={},installed={},catalog=[]){
    const result=Object.create(null),plugins=Array.isArray(catalog)?catalog:[];
    const unique=values=>[...new Map(values.map(repositoryUrl).filter(Boolean).map(url=>[url.toLowerCase(),url])).values()];
    for(const name of names){
      const spec=installed.installed?.[name]??local.specs?.[name]??'';
      const source=repositoryUrl(spec);
      if(source){result[name]=source;continue;}
      // A URL install from another host must not be reassigned to an unrelated
      // catalog entry merely because the packages happen to share a name.
      if(typeof spec==='string'&&/^(?:https?:|git\+|git:|ssh:)/i.test(spec))continue;
      const known=unique([...(Array.isArray(installed.repoIdentities?.[name])?installed.repoIdentities[name]:[]),local.repositories?.[name]]);
      if(known.length===1){result[name]=known[0];continue;}
      if(known.length>1)continue;
      const hints=unique(Array.isArray(installed.repoHints?.[name])?installed.repoHints[name]:[]);
      if(hints.length===1){result[name]=hints[0];continue;}
      const npmAlias=typeof spec==='string'?spec.match(/^npm:((?:@[^/]+\/)?[^@]+)(?:@|$)/)?.[1]:null;
      const keys=new Set([name,npmAlias].filter(Boolean).map(x=>x.toLowerCase()));
      // Prefer npm identity; only use the catalog name if it has one unique repo.
      let matches=plugins.filter(p=>typeof p?.npm==='string'&&keys.has(p.npm.toLowerCase()));
      if(!matches.length)matches=plugins.filter(p=>typeof p?.name==='string'&&keys.has(p.name.toLowerCase()));
      const urls=unique(matches.map(p=>p.url));
      if(urls.length===1)result[name]=urls[0];
    }
    return result;
  }
  return {repositoryUrl,resolveRepositories};
}
module.exports={createRepositoryTools};
