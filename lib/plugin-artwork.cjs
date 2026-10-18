'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const routes=require('./read-routes.cjs');
const {repositoryUrl}=require('./repositories.cjs').createRepositoryTools();
const LIMIT=1024*1024, TOTAL_LIMIT=16*1024*1024;
// Verified upstream marks for packages that draw their own settings glyph but
// do not declare an icon in their manifest. See assets/third-party/SOURCES.txt.
const compatibility={
  dshmarket:{repository:'https://github.com/dsh-market/dsh-market',file:'dshmarket.svg'},
  '@michengai/dsh-skills-manager':{repository:'https://github.com/MichengAI/dsh-skills-manager',file:'skills-manager.svg',mask:true}
};
function inside(root,file){const relative=path.relative(root,file);return relative!==''&&!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep);}
function exportedIcon(value){
  if(typeof value==='string')return value;
  if(value&&typeof value==='object'&&!Array.isArray(value))for(const condition of ['browser','import','require','default']){const file=exportedIcon(value[condition]);if(file)return file;}
  return null;
}
async function readImage(root,value,signal){
  if(typeof value!=='string'||value.length>1024||value.includes('\0')||/^[a-z][a-z\d+.-]*:/i.test(value))return null;
  const target=path.resolve(root,value);if(!inside(root,target))return null;
  const real=await fs.realpath(target);if(!inside(root,real))return null;
  const types={'.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.ico':'image/x-icon'};
  const mime=types[path.extname(real).toLowerCase()];if(!mime)return null;
  signal?.throwIfAborted();const handle=await fs.open(real,'r');
  try{
    const stat=await handle.stat();if(!stat.isFile()||stat.size<=0||stat.size>LIMIT)return null;
    const bytes=Buffer.alloc(Math.min(LIMIT+1,stat.size+1));let length=0;
    while(length<bytes.length){signal?.throwIfAborted();const result=await handle.read(bytes,length,bytes.length-length,null);if(!result.bytesRead)break;length+=result.bytesRead;}
    if(length!==stat.size)return null;
    signal?.throwIfAborted();return 'data:'+mime+';base64,'+bytes.subarray(0,length).toString('base64');
  }finally{await handle.close();}
}
async function readArtwork(profile,signal){
  signal?.throwIfAborted();
  const manifest=JSON.parse(await fs.readFile(path.join(profile.dir,'package.json'),'utf8'));
  const names=new Set([...Object.keys(manifest.dependencies||{}),...(manifest.dsh?.profile?.bundles||[])]),icons=Object.create(null);
  let total=0;
  for(const name of names){
    signal?.throwIfAborted();
    if(typeof name!=='string'||name.startsWith('@deepseek-ai/')||!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i.test(name))continue;
    try{
      const root=await fs.realpath(path.join(profile.dir,'node_modules',name)),pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
      let src=null,mask=false;
      for(const file of [pkg.icon,pkg.dsh?.icon,exportedIcon(pkg.exports?.['./icon'])]){
        try{src=await readImage(root,file,signal);}catch{signal?.throwIfAborted();}
        if(src)break;
      }
      if(!src){
        const fallback=compatibility[pkg.name];
        if(fallback&&repositoryUrl(pkg.repository)?.toLowerCase()===fallback.repository.toLowerCase()){
          const assets=await fs.realpath(path.join(__dirname,'../assets/third-party'));
          src=await readImage(assets,fallback.file,signal);mask=!!fallback.mask;
        }
      }
      if(src&&total+src.length<=TOTAL_LIMIT){icons[name]={src,mask,version:pkg.version};total+=src.length;}
    }catch{signal?.throwIfAborted();}
  }
  return {icons};
}
function register(ctx,profile){routes.register(ctx,{'plugin-artwork':signal=>readArtwork(profile,signal)});}
module.exports={register};
