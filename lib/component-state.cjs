'use strict';
const fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module'),{pathToFileURL}=require('node:url');
async function enabled(profile,id){
  const manifest=JSON.parse(fs.readFileSync(path.join(profile.dir,'package.json'),'utf8'));
  if(!manifest.dsh?.profile?.bundles?.includes('dsh-local-plugin-center'))return false;
  const boot=await import(pathToFileURL(createRequire(profile.installAnchor).resolve('@deepseek-ai/dsh-app-boot')).href);
  const loaded=boot.loadProfileDirectory('tanuki',profile.dir,profile.installAnchor);
  const extra=boot.loadOptionalPatches('tanuki',path.join(path.dirname(path.dirname(profile.dir)),'cordis.patch.yml'))||[];
  const entry=boot.composeEntries([...loaded.layers.map(l=>l.patches),loaded.patches,extra]).find(e=>e.id===id);
  if(!entry)return false;
  if(entry.disabled===undefined||entry.disabled===false)return true;
  if(entry.disabled===true)return false;
  return null;
}
module.exports={enabled};
