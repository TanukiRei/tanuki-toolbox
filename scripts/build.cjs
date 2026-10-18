const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const {enabledUpdateCounts}=require(path.join(root,'lib/policy.cjs'));
const {createMarketUpdater}=require(path.join(root,'lib/update-client.cjs'));
const {createRecommendationComponents}=require(path.join(root,'lib/recommendations-client.cjs'));
const {createRepositoryTools}=require(path.join(root,'lib/repositories.cjs'));
const {createDetailNavigation}=require(path.join(root,'lib/detail-navigation.cjs'));
const {createViewHandoff}=require(path.join(root,'lib/view-handoff.cjs'));
const {createNotificationIsland}=require(path.join(root,'lib/island-client.cjs'));
const {createAudioPreview}=require(path.join(root,'lib/audio-preview-client.cjs'));
const {createBubbleModel}=require(path.join(root,'lib/global-bubbles-client.cjs'));
const {createPluginAliases}=require(path.join(root,'lib/plugin-aliases-client.cjs'));
const {createPluginArtwork}=require(path.join(root,'lib/plugin-artwork-client.cjs'));
async function main(){
  const data=file=>'data:image/'+(file.endsWith('.svg')?'svg+xml':'png')+';base64,'+fs.readFileSync(path.join(root,file)).toString('base64');
  const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
  const substitutions={
    __VERSION__:JSON.stringify(version),__VERSION_TEXT__:version,
    __CENTER_ICON__:JSON.stringify(data('components/plugin-center/icon.svg')),
    __DSH_NOTIFICATION_ICON__:JSON.stringify(data('assets/dsh-notification.png')),
    __COMPONENT_ICONS__:JSON.stringify(Object.fromEntries(['plugin-center','home','dynamic-island','startup-guard','sidebar'].map(name=>[name,data('components/'+name+'/icon.svg')]))),
    __AUDIO_PREVIEW_FACTORY__:createAudioPreview.toString(),__BUBBLES_FUNCTION__:createBubbleModel.toString(),__ARTWORK_FUNCTION__:createPluginArtwork.toString(),
    __COUNT_FUNCTION__:enabledUpdateCounts.toString(),__UPDATE_FUNCTION__:createMarketUpdater.toString(),
    __RECOMMENDATIONS_FUNCTION__:createRecommendationComponents.toString(),__REPOSITORIES_FUNCTION__:createRepositoryTools.toString(),
    __DETAIL_NAVIGATION_FUNCTION__:createDetailNavigation.toString(),__VIEW_HANDOFF_FUNCTION__:createViewHandoff.toString(),__ISLAND_FUNCTION__:createNotificationIsland.toString(),__ALIASES_FUNCTION__:createPluginAliases.toString()
  };
  function compile(template,values,file){
    const source=template.replace(/__[A-Z][A-Z_]*__/g,key=>{if(!(key in values))throw new Error('Missing build token: '+key);return values[key];});
    new vm.Script(source,{filename:file}); // Parse only; do not execute components during packaging.
    fs.writeFileSync(path.join(root,file),source);return Buffer.byteLength(source);
  }
  const clientBytes=compile(fs.readFileSync(path.join(root,'client.template.js'),'utf8'),substitutions,'client.js');
  fs.mkdirSync(path.join(root,'client-chunks'),{recursive:true});const chunks={};
  for(const name of ['plugin-center','home','dynamic-island','sidebar','toolbox-details','guard-settings','toolbox-settings','global-bubbles']){
    const source=path.join(root,'client-src',name),css=fs.existsSync(source+'.css')?fs.readFileSync(source+'.css','utf8'):'';
    const locales=JSON.parse(fs.readFileSync(source+'.locale.json','utf8'));
    chunks[name]=compile(fs.readFileSync(source+'.template.js','utf8'),{...substitutions,__LOCALES__:JSON.stringify(locales),__CSS__:JSON.stringify(css)},'client-chunks/'+name+'.js');
  }
  console.log(JSON.stringify({version,clientBytes,chunks,toolboxBytes:fs.statSync(path.join(root,'assets/toolbox.png')).size,centerBytes:fs.statSync(path.join(root,'components/plugin-center/icon.svg')).size}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
