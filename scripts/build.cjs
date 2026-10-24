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
const {createWorkspaceSplitter}=require(path.join(root,'lib/workspace-splitter-client.cjs'));
const {createSortMotion}=require(path.join(root,'lib/sort-motion-client.cjs'));
const {createToolboxLocale}=require(path.join(root,'lib/locale-client.cjs'));
const {createModelForms}=require(path.join(root,'client-src/settings-model-forms.cjs'));
const {createSettingsSelect}=require(path.join(root,'lib/settings-select-client.cjs'));
const {createRulesEditor}=require(path.join(root,'lib/rules-editor-client.cjs'));
const {startRulesWindow}=require(path.join(root,'lib/rules-window-client.cjs'));
async function main(){
  const agentBuild=JSON.parse(fs.readFileSync(path.join(root,'launcher/AgentSetup.build.json'),'utf8'));
  const agentSha=file=>require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,'launcher',file))).digest('hex');
  if(agentSha('AgentSetup.cs')!==agentBuild.sourceSha256||agentSha('AgentSetup.exe')!==agentBuild.binarySha256)throw new Error('Rebuild Agent setup using scripts/build-agent-setup.ps1');
  // Validate checked-in native artifacts without starting the restart worker.
  const workerBuild=JSON.parse(fs.readFileSync(path.join(root,'launcher/RestartWorker.build.json'),'utf8'));
  const sha=file=>require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,'launcher',file))).digest('hex');
  if(sha('RestartWorker.cs')!==workerBuild.sourceSha256||sha('RestartWorker.exe')!==workerBuild.binarySha256)throw new Error('Rebuild the native restart worker using scripts/build-restart-worker.ps1');
  const rulesBuild=JSON.parse(fs.readFileSync(path.join(root,'launcher/RulesWindow.build.json'),'utf8'));
  if(sha('RulesWindow.cs')!==rulesBuild.sourceSha256||sha('RulesWindow.exe')!==rulesBuild.binarySha256)throw new Error('Rebuild the rules editor using scripts/build-rules-window.ps1');
  for(const [file,digest]of Object.entries(rulesBuild.assets||{}))if(sha(file)!==digest)throw new Error('Native rule editor asset mismatch: '+file);
  for(const file of ['launcher/auth-cookie-cleanup.cjs','launcher/launch.cjs','launcher/restart-controller.cjs','launcher/preflight.cjs','lib/autostart.cjs','lib/shortcut-controller.cjs','lib/toolbox-settings.cjs','lib/sidebar-restart.cjs','lib/rules-store.cjs','lib/rules-runtime.cjs','lib/rules-window.cjs','lib/recycle-bin.cjs','lib/agent-interface.cjs','lib/agent-interface-store.cjs','lib/agent-interface-spec.cjs','lib/agent-desktop.cjs','launcher/agent-desktop-install.cjs'])new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
  const data=file=>'data:image/'+(file.endsWith('.svg')?'svg+xml':'png')+';base64,'+fs.readFileSync(path.join(root,file)).toString('base64');
  const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
  const substitutions={
    __SORT_MOTION_FACTORY__:createSortMotion.toString(),
    __RULES_EDITOR_FACTORY__:createRulesEditor.toString(),
    __SETTINGS_SELECT_FACTORY__:createSettingsSelect.toString(),
    __LOCALE_FACTORY__:createToolboxLocale.toString(),
    __MODEL_FORMS_FACTORY__:createModelForms.toString(),
    __VERSION__:JSON.stringify(version),__VERSION_TEXT__:version,__WORKSPACE_SPLITTER_FUNCTION__:createWorkspaceSplitter.toString(),
    __CENTER_ICON__:JSON.stringify(data('components/plugin-center/icon.svg')),
    __DSH_NOTIFICATION_ICON__:JSON.stringify(data('assets/dsh-notification.png')),
    __COMPONENT_ICONS__:JSON.stringify(Object.fromEntries(['plugin-center','home','dynamic-island','startup-guard','sidebar','composer','settings-enhancements','rules','recycle-bin','agent-interface'].map(name=>[name,data('components/'+name+'/icon.svg')]))),
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
  const rulesCss=fs.readFileSync(path.join(root,'client-src/rules.css'),'utf8');
  const dictionaries=JSON.parse(fs.readFileSync(path.join(root,'client-src/rules.locale.json'),'utf8'));
  const nativeScript='('+startRulesWindow.toString()+')('+createRulesEditor.toString()+','+JSON.stringify(dictionaries)+');';new vm.Script(nativeScript,{filename:'RulesEditor.html script'});
  const nonce=require('node:crypto').createHash('sha256').update(nativeScript).digest('hex').slice(0,32);
  const page='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'nonce-'+nonce+'\'; style-src \'unsafe-inline\'; img-src data:; base-uri \'none\'; form-action \'none\'"><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}'+rulesCss+'#rules-root{left:0;top:0;width:100%;height:100%;min-width:0;min-height:0;max-width:none;max-height:none;animation:none;box-shadow:none}</style></head><body><section id="rules-root" class="tanuki-rules-panel"></section><script nonce="'+nonce+'">'+nativeScript.replace(/<\/script/gi,'<\\/script')+'</script></body></html>';
  fs.writeFileSync(path.join(root,'launcher/RulesEditor.html'),page);
  const clientBytes=compile(fs.readFileSync(path.join(root,'client.template.js'),'utf8'),substitutions,'client.js');
  fs.mkdirSync(path.join(root,'client-chunks'),{recursive:true});const chunks={};
  for(const name of ['plugin-center','home','dynamic-island','sidebar','toolbox-details','guard-settings','toolbox-settings','model-settings','model-policy','global-bubbles','composer','composer-clock','composer-model','composer-files','system-settings','settings-window','settings-enhancements','settings-models','gateway-speed','rules','composer-list','recycle-bin','agent-interface','agent-interface-events']){
    const source=path.join(root,'client-src',name),css=fs.existsSync(source+'.css')?fs.readFileSync(source+'.css','utf8'):'';
    const selectCss=name==='settings-models'?fs.readFileSync(path.join(root,'client-src/settings-select.css'),'utf8'):'';
    const locales=JSON.parse(fs.readFileSync(source+'.locale.json','utf8'));
    // Build-time translation audit only; does not start components or run functional tests.
    for(const key of new Set([...Object.keys(locales.zh||{}),...Object.keys(locales.en||{})])){
      if(typeof locales.zh?.[key]!=='string'||typeof locales.en?.[key]!=='string')throw new Error('Missing zh/en translation: '+name+'.'+key);
      const params=value=>[...value.matchAll(/\{(\w+)\}/g)].map(match=>match[1]).sort().join(',');
      if(params(locales.zh[key])!==params(locales.en[key]))throw new Error('Translation placeholder mismatch: '+name+'.'+key);
    }
    chunks[name]=compile(fs.readFileSync(source+'.template.js','utf8'),{...substitutions,__LOCALES__:JSON.stringify(locales),__CSS__:JSON.stringify(css+selectCss)},'client-chunks/'+name+'.js');
  }
  console.log(JSON.stringify({version,clientBytes,chunks,toolboxBytes:fs.statSync(path.join(root,'assets/toolbox.png')).size,centerBytes:fs.statSync(path.join(root,'components/plugin-center/icon.svg')).size}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
