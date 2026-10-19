document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),h=React.createElement,NS='tanukiGuardSettings';
  function apply(ctx,{ready}){
    const toolboxLocale=(function createToolboxLocale(ctx, namespace, dictionaries) {
  const language = () => /^zh(?:[-_]|$)/i.test(ctx.locale.getSnapshot()?.active || '') ? 'zh' : 'en';
  const text = value => {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    const result = language() === 'zh' ? value.zh ?? value['zh-CN'] ?? value['zh-cn'] ?? value['zh-TW'] ?? value['zh-tw'] ?? value.en : value.en;
    return typeof result === 'string' ? result : '';
  };
  const t = (key, params) => {
    const template = dictionaries[language()]?.[key] ?? dictionaries.en?.[key] ?? key;
    return params ? template.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(params, name) ? String(params[name]) : match) : template;
  };
  ctx.effect(() => {
    const known = new Set(), disposers = [];
    function registerLanguages() {
      const entries = { en: dictionaries.en || {}, zh: dictionaries.zh || {} };
      for (const locale of ctx.locale.getSnapshot()?.locales || []) {
        const id = typeof locale === 'string' ? locale : locale.id;
        if (typeof id === 'string') entries[id] = /^zh(?:[-_]|$)/i.test(id) ? dictionaries.zh || dictionaries.en : dictionaries.en;
      }
      const pending = Object.fromEntries(Object.entries(entries).filter(([id]) => !known.has(id.toLowerCase())));
      if (!Object.keys(pending).length) return;
      for (const id of Object.keys(pending)) known.add(id.toLowerCase());
      disposers.push(ctx.locale.register(namespace, pending));
    }
    registerLanguages();
    const off = ctx.locale.subscribe(registerLanguages);
    return () => { off(); for (const dispose of disposers.reverse()) dispose(); };
  });
  return { t, text, language };
})(ctx,NS,{"zh":{"shortcutTitle":"快捷方式保护","shortcutPending":"正在准备快捷方式保护…","shortcutEnabling":"正在查找并接管 DSH 快捷方式…","shortcutRestoring":"正在还原 DSH 快捷方式…","shortcutEnabled":"已接管 {n} 个 DSH 快捷方式","shortcutRestored":"快捷方式已还原为原来的启动方式","shortcutNone":"没有找到可接管的 DSH 快捷方式","shortcutPartial":"部分 DSH 快捷方式未能处理，可在启动保护设置中查看。","shortcutError":"快捷方式保护未完成，请重新开关启动保护后重试。","shortcutBehavior":"开启时备份并接管现有入口，关闭时还原。正常退出 DSH 会保留保护入口。","shortcutScope":"覆盖可访问的桌面、开始菜单、经典固定项、用户文件夹及 Windows 索引中的 DSH 快捷方式。Windows 11 缓存的固定项可能需要取消固定后重新固定。","shortcutDetails":"未处理的入口","shortcutChanged":"已被手动修改，保留现状","shortcutDenied":"无法写入此入口","shortcutBackupMissing":"原备份缺失或已改变","shortcutUnsupported":"快捷方式接管目前仅支持 Windows。macOS 不会改写 Dock 或登录项；启动保护组件仍会检查运行中明确声明的版本不兼容插件。"},"en":{"shortcutTitle":"Shortcut protection","shortcutPending":"Preparing shortcut protection…","shortcutEnabling":"Finding and protecting DSH shortcuts…","shortcutRestoring":"Restoring DSH shortcuts…","shortcutEnabled":"Protected {n} DSH shortcuts","shortcutRestored":"Shortcuts restored to their original launch method","shortcutNone":"No DSH shortcuts were found to protect","shortcutPartial":"Some DSH shortcuts could not be processed. See Startup Guard settings.","shortcutError":"Shortcut protection did not finish. Toggle Startup Guard off and on to retry.","shortcutBehavior":"Enabling backs up and protects existing shortcuts; disabling restores them. Quitting DSH keeps protection in place.","shortcutScope":"Covers accessible desktop, Start menu, classic pinned, user-folder and Windows-indexed DSH shortcuts. Cached Windows 11 pins may need to be unpinned and pinned again.","shortcutDetails":"Unprocessed shortcuts","shortcutChanged":"Manually modified; left unchanged","shortcutDenied":"Unable to write this shortcut","shortcutBackupMissing":"Original backup is missing or changed","shortcutUnsupported":"Shortcut management currently supports Windows only. On macOS it does not modify Dock entries or login items; Startup Guard can still check explicitly declared plugin version incompatibilities in the running host."}}),t=toolboxLocale.t;
    ctx.effect(()=>{const style=document.createElement('style');style.textContent=".tanuki-shortcut-settings{font-size:14px;line-height:22px;}\n.tanuki-shortcut-settings h4{font-size:16px;margin:0 0 12px;}\n.tanuki-shortcut-settings li{margin-top:10px;overflow-wrap:anywhere;}\n.tanuki-shortcut-settings li>div{font-size:12px;opacity:.75;}\n\n";document.head.appendChild(style);return()=>style.remove();});
    function Settings(){
      React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());
      const [report,setReport]=React.useState(null);
      React.useEffect(()=>{
        let alive=true,flight=null;const requests=new Set();
        function refresh(){
          if(!alive||flight)return;
          const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);requests.add(controller);
          flight=fetch(new URL('tanuki-toolbox/status',document.baseURI),{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(r=>{if(!r.ok)throw new Error('Status unavailable');return r.json();}).then(value=>{if(alive){setReport(value.shortcuts);if(value.shortcuts?.status==='unsupported')clearInterval(interval);}}).catch(()=>{}).finally(()=>{clearTimeout(timer);requests.delete(controller);flight=null;});
        }
        refresh();const interval=setInterval(refresh,4000);
        return()=>{alive=false;clearInterval(interval);for(const controller of requests)controller.abort();};
      },[]);
      if(report?.status==='unsupported')return h('div',{className:'tanuki-shortcut-settings'},h('h4',null,t('shortcutTitle')),h('p',{role:'status'},t('shortcutUnsupported')));
      const keys={pending:'shortcutPending',enabling:'shortcutEnabling',restoring:'shortcutRestoring',enabled:'shortcutEnabled',restored:'shortcutRestored',none:'shortcutNone',partial:'shortcutPartial',error:'shortcutError'};
      return h('div',{className:'tanuki-shortcut-settings'},h('h4',null,t('shortcutTitle')),h('p',{role:'status'},t(keys[report?.status]||'shortcutPending',{n:String(report?.managed||0)})),h('p',null,t('shortcutBehavior')),h('p',{style:{opacity:.75}},t('shortcutScope')),report?.warnings?.some(w=>w.path)?h('details',null,h('summary',null,t('shortcutDetails')),h('ul',null,...report.warnings.filter(w=>w.path).map((w,i)=>h('li',{key:i},h('span',null,t(w.code==='changed'?'shortcutChanged':w.code==='backup-missing'?'shortcutBackupMissing':'shortcutDenied')),h('div',null,w.path))))):null);
    }
    ready(Settings);
  }
  return {name:'tanuki-guard-settings',inject:['locale'],apply};
});
