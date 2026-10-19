document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),h=React.createElement,{createPortal}=require('react-dom');
  const {FishLogo,IconSkillOutlineRegular}=require('@deepseek-ai/dsh-client-ui-primitives'),NS='tanukiSidebar',HOME='tanuki-sidebar-home';
  const createWorkspaceSplitter=__WORKSPACE_SPLITTER_FUNCTION__;
  function apply(ctx,{lifecycle}){
    let alive=true,current=null,frameRequest=null,settingsCleanup=null,toolboxCleanup=null,accountMount=null,accountCleanup=null,menuCleanup=null;
    const visibilityKey='tanuki.sidebar.visibility.v1',paneKey='tanuki.sidebar.workspace-collapsed.v1',optionalItems=['workspace','automations','skills','toolbox','plugins','restart'];
    const orderKey='tanuki.sidebar.order.v2',legacyOrderKey='tanuki.sidebar.order.v1',defaultOrder={top:['home','newSession','workspace','more'],bottom:['automations','skills','toolbox','plugins','settings','restart']};
    const allItems=[...defaultOrder.top,...defaultOrder.bottom];
    // Both groups use visual top-to-bottom order; the bottom group stays bottom-aligned.
    function normalizeOrder(saved){
      const seen=new Set(),order={top:[],bottom:[]};
      for(const group of ['top','bottom'])for(const key of Array.isArray(saved?.[group])?saved[group]:[]){
        if(allItems.includes(key)&&!seen.has(key)){order[group].push(key);seen.add(key);}
      }
      for(const group of ['top','bottom'])for(const key of defaultOrder[group])if(!seen.has(key)){const target=key==='skills'?['top','bottom'].find(g=>order[g].includes('toolbox')):undefined;if(target)order[target].splice(order[target].indexOf('toolbox'),0,key);else order[group].push(key);seen.add(key);}
      return order;
    }
    function readOrder(){
      try{
        const saved=localStorage.getItem(orderKey);
        if(saved!==null)return normalizeOrder(JSON.parse(saved));
        const legacy=JSON.parse(localStorage.getItem(legacyOrderKey)||'null');
        // Preserve the actual rail positions from v1 while reversing its bottom-up menu.
        return normalizeOrder(legacy?{top:legacy.top,bottom:Array.isArray(legacy.bottom)?[...legacy.bottom].reverse():undefined}:null);
      }catch{return normalizeOrder(null);}
    }
    function moveItem(key,group,index){
      if(!alive||!allItems.includes(key)||!['top','bottom'].includes(group))return;
      const order={top:state.order.top.filter(item=>item!==key),bottom:state.order.bottom.filter(item=>item!==key)};
      order[group].splice(Math.max(0,Math.min(order[group].length,index)),0,key);
      if(JSON.stringify(order)===JSON.stringify(state.order))return;
      publish({order});
      try{localStorage.setItem(orderKey,JSON.stringify(order));}catch{notify('orderSaveFailed');}
    }
    function readCollapsed(){try{return localStorage.getItem(paneKey)==='true';}catch{return false;}}
    const widthKey='tanuki.sidebar.workspace-width.v1';let previewWidth=null;
    function readWidth(){try{const value=Number(localStorage.getItem(widthKey));return Number.isFinite(value)&&value>=220&&value<=600?value:null;}catch{return null;}}
    let preferredWidth=readWidth();
    function widthLimits(){
      const frame=current?.frame,right=frame&&[...frame.children].find(node=>[...node.classList].some(name=>name.endsWith('_rightbarCol')||name.endsWith('_rightCol')));
      const rightWidth=right?.getBoundingClientRect().width||0,centerMin=rightWidth>0?400:360;
      return {min:220,max:Math.max(220,Math.min(600,Math.floor((frame?.clientWidth||window.innerWidth)-52-centerMin-rightWidth)))};
    }
    function saveWidth(width){previewWidth=null;preferredWidth=Math.round(width);updateLayout();try{localStorage.setItem(widthKey,String(preferredWidth));}catch{notify('widthSaveFailed');}}
    const hasAutomations=()=>ctx.slots.entriesOfSlot('main').some(entry=>entry.options?.key==='schedules');
    const hasSkills=()=>ctx.slots.entriesOfSlot('settings.section').some(entry=>entry.options?.id==='skills-manager');
    function readVisibility(){try{const saved=JSON.parse(localStorage.getItem(visibilityKey)||'{}');return Object.fromEntries(optionalItems.map(key=>[key,saved?.[key]!==false]));}catch{return Object.fromEntries(optionalItems.map(key=>[key,true]));}}
    const listeners=new Set(),requests=new Set();let focusWorkspaceToggle=null,state={target:null,workspaceTarget:null,conversationTarget:null,accountTarget:null,accountBusy:false,workspaceCollapsed:readCollapsed(),pane:ctx.layout.panelInfo.getSnapshot().activePanelId===null&&!readCollapsed(),automationsAvailable:hasAutomations(),skillsAvailable:hasSkills(),skillsOpen:false,restarting:false,settingsOpen:false,toolboxOpen:false,visibility:readVisibility(),order:readOrder()};
    const publish=next=>{if(!alive)return;state={...state,...next};for(const fn of listeners)fn();};
    const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
    const toolboxLocale=(__LOCALE_FACTORY__)(ctx,NS,__LOCALES__),t=toolboxLocale.t;
    const notify=(key,code)=>{const suffix=typeof code==='string'&&/^[A-Z_]{1,80}$/.test(code)?' ['+code+']':'';window.dispatchEvent(new CustomEvent('tanuki:notify',{detail:{kind:'error',destination:{page:'settings',section:'tanuki-toolbox',component:'sidebar'},title:{zh:'侧边栏',en:'Sidebar'},message:{zh:__LOCALES__.zh[key]+suffix,en:__LOCALES__.en[key]+suffix}}}));};
    function useLocale(){React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());return t;}
    function updateLayout(){
      if(!alive||!current)return;
      const {frame,root}=current,original=frame.style.gridTemplateColumns;
      const collapsed=frame.hasAttribute('data-sidebar-collapsed');
      if(!collapsed)current.expanding=false;
      // Native shortcuts/narrow-layout changes must not turn an open workspace into a rail.
      if(state.pane&&collapsed&&!current.expanding){current.expanding=true;ctx.layout.toggleSidebar();}
      const match=original.match(/^([\d.]+)px\s+(.+)$/);if(!match)return;
      if(!collapsed)current.paneWidth=Math.max(220,Number(match[1])||280);
      const limits=widthLimits(),paneWidth=Math.max(limits.min,Math.min(limits.max,previewWidth??preferredWidth??current.paneWidth??280)),left=state.pane?paneWidth+52:52;
      current.renderedWidth=paneWidth;
      const columns=left+'px '+match[2];
      if(frame.style.getPropertyValue('--tanuki-shell-columns')!==columns)frame.style.setProperty('--tanuki-shell-columns',columns);
      if(frame.style.getPropertyValue('--tanuki-left-width')!==left+'px')frame.style.setProperty('--tanuki-left-width',left+'px');
      if(frame.style.getPropertyValue('--tanuki-workspace-width')!==paneWidth+'px')frame.style.setProperty('--tanuki-workspace-width',paneWidth+'px');
      const mode=state.pane?'open':'closed';if(frame.getAttribute('data-tanuki-workspace')!==mode)frame.setAttribute('data-tanuki-workspace',mode);
      if(root.getAttribute('data-tanuki-sidebar-root')!=='')root.setAttribute('data-tanuki-sidebar-root','');
      syncWorkspaceInteraction();
      current.splitter?.sync(state.pane);
    }
    // Main-panel selection and the user's collapse preference control the pane. Settings
    // dialogs/account menus do not select a panel and must not hide its backdrop.
    // Keep the native workspace mounted; optional rail-icon visibility is separate.
    function syncPane(){
      const pane=ctx.layout.panelInfo.getSnapshot().activePanelId===null&&!state.workspaceCollapsed;
      // Commit visual/interaction state before subscribers transfer focus.
      if(state.pane!==pane){state={...state,pane};updateLayout();publish({pane});}
      else updateLayout();
    }
    function setWorkspaceCollapsed(collapsed,focus=false){
      if(!alive)return;
      if(focus)focusWorkspaceToggle=collapsed?'expand':'collapse';
      publish({workspaceCollapsed:collapsed});syncPane();
      try{localStorage.setItem(paneKey,String(collapsed));}catch{notify('paneSaveFailed');}
    }
    function openWorkspace(){setWorkspaceCollapsed(false);navigate(null);syncPane();}
    function restoreWorkspaceInteraction(){
      const saved=current?.workspaceInteraction;if(!saved)return;
      saved.node.inert=saved.inert;current.workspaceInteraction=null;
    }
    function syncWorkspaceInteraction(){
      const node=current.root.querySelector('[data-slot="sidebar.workspaces"]');
      if(current.workspaceInteraction?.node!==node){restoreWorkspaceInteraction();if(node)current.workspaceInteraction={node,inert:node.inert};}
      // A fading workspace is still drawn, but must already stop accepting input.
      if(node){const inert=!state.pane||current.workspaceInteraction.inert;if(node.inert!==inert)node.inert=inert;}
    }
    function attachWorkspaceControls(){
      if(!current)return;
      const controls=current.root.querySelector('[data-slot="sidebar.workspaces"] [class*="_sectionHeader"] > [class*="_headerActions"]');
      if(current.workspaceHost?.parentElement===controls&&current.workspaceHost.isConnected)return;
      current.workspaceHost?.remove();current.workspaceHost=null;
      if(controls){const host=document.createElement('span');host.setAttribute('data-tanuki-workspace-toggle-host','');controls.appendChild(host);current.workspaceHost=host;}
      if(state.workspaceTarget!==current.workspaceHost)publish({workspaceTarget:current.workspaceHost});
    }
    function attachConversationControls(){
      if(!current)return;
      // Anchor a floating tab to the conversation column's left edge. It must
      // never join the native header flow or reserve space beside the title.
      const column=[...current.frame.children].find(node=>[...node.classList].some(name=>name.endsWith('_centerCol')));
      if(current.conversationHost?.isConnected&&current.conversationHost.parentElement===column)return;
      current.conversationHost?.remove();current.conversationHost=null;
      if(column){const host=document.createElement('div');host.setAttribute('data-tanuki-conversation-expand-host','');column.appendChild(host);current.conversationHost=host;}
      if(state.conversationTarget!==current.conversationHost)publish({conversationTarget:current.conversationHost});
    }
    function detach(){
      if(!current)return;
      const {frame,col,root,host,observer}=current;observer.disconnect();
      current.splitter?.dispose();previewWidth=null;
      restoreWorkspaceInteraction();
      frame.removeAttribute('data-tanuki-shell');frame.removeAttribute('data-tanuki-workspace');frame.style.removeProperty('--tanuki-shell-columns');frame.style.removeProperty('--tanuki-left-width');frame.style.removeProperty('--tanuki-workspace-width');
      col.removeAttribute('data-tanuki-sidebar-col');root.removeAttribute('data-tanuki-sidebar-root');current.workspaceHost?.remove();current.conversationHost?.remove();host.remove();current=null;
      if(state.workspaceTarget||state.conversationTarget)publish({workspaceTarget:null,conversationTarget:null});
    }
    // Verified against the installed account bundle: there is no account-action slot.
    // Only this signed-in DeepSeek Platform card owns this link (not Codex/provider settings).
    // Unknown/ambiguous native markup is deliberately left untouched.
    function accountAnchor(){
      const links=[...document.querySelectorAll('[data-shortcut-modal="settings"] section._8RVnMG_section > div._8RVnMG_card > a._8RVnMG_accountInfo[target="_blank"][rel="noopener noreferrer"]')];
      if(links.length!==1)return null;
      const link=links[0],card=link.parentElement,identity=card.querySelector(':scope > ._8RVnMG_identity');
      if(!identity||!link.href||link.textContent.trim()!==ctx.locale.bind('settings.account')('accountInfo'))return null;
      return {link,card,identity};
    }
    function detachAccount(){
      accountCleanup?.();accountMount?.host.remove();accountMount=null;
      if(state.accountTarget)publish({accountTarget:null});
    }
    function attachAccount(){
      const anchor=accountAnchor();
      if(accountMount&&anchor?.link===accountMount.link&&accountMount.host.isConnected)return;
      detachAccount();if(!anchor)return;
      const host=document.createElement('span');host.setAttribute('data-tanuki-account-signout','');
      host.style.cssText='display:inline-flex;flex:none;margin-left:auto';anchor.card.insertBefore(host,anchor.link);
      accountMount={...anchor,host};publish({accountTarget:host});
    }
    function requestAccountSignOut(){
      if(!alive||state.accountBusy)return;
      const anchor=accountAnchor(),mount=accountMount;
      const triggers=[...document.querySelectorAll('[data-slot="sidebar.settings"] [data-slot="settings.launcher"] button[aria-haspopup="menu"][data-signed-out="false"]')];
      if(!anchor||anchor.link!==mount?.link||triggers.length!==1){notify('unavailable');return;}
      // Delegate to the real AccountMenu action, NOT a synthetic logout endpoint.
      // Native flow checks running tasks, then opens its existing SignOutDialog;
      // remote.account.signOut(client()) removes only the DeepSeek Platform grant.
      const trigger=triggers[0],identity=anchor.identity.textContent,href=anchor.link.href;
      const tr=ctx.locale.bind('settings.account'),existing=new Set(document.querySelectorAll('[role="menu"]')),wasOpen=trigger.getAttribute('aria-expanded')==='true';
      let done=false,timer,watch;
      publish({accountBusy:true});
      const cleanup=(handedOff=false)=>{if(done)return;done=true;watch?.disconnect();clearTimeout(timer);if(!handedOff&&!wasOpen&&trigger.isConnected&&trigger.getAttribute('aria-expanded')==='true')trigger.click();if(accountCleanup===cleanup)accountCleanup=null;if(alive)publish({accountBusy:false});};
      const fail=()=>{cleanup();if(alive)notify('unavailable');};
      const find=()=>{
        if(!alive){cleanup();return;}
        const now=accountAnchor();
        if(!now||now.link!==anchor.link||now.identity.textContent!==identity||now.link.href!==href||trigger.getAttribute('data-signed-out')!=='false'){fail();return;}
        const menus=[...document.querySelectorAll('[role="menu"]')].filter(menu=>wasOpen||!existing.has(menu)).map(menu=>{
          const rows=[...menu.querySelectorAll('button[role="menuitem"]')];
          const label=row=>[...row.querySelectorAll('span')].some(span=>span.textContent.trim()===tr('signOut'));
          const signouts=rows.filter(label);
          const has=key=>rows.some(row=>[...row.querySelectorAll('span')].some(span=>span.textContent.trim()===tr(key)));
          return rows.length===3&&signouts.length===1&&has('settings')&&has('contactUs')?signouts[0]:null;
        }).filter(Boolean);
        if(menus.length!==1||menus[0].disabled)return;
        const button=menus[0];cleanup(true);button.click();
      };
      watch=new MutationObserver(find);accountCleanup=cleanup;watch.observe(document.body,{childList:true,subtree:true});
      timer=setTimeout(fail,2000);if(!wasOpen)trigger.click();find();
    }
    function AccountSignOut(){
      const model=React.useSyncExternalStore(subscribe,()=>state);useLocale();
      if(!model.accountTarget)return null;
      return createPortal(h('button',{type:'button',className:'_8RVnMG_linkButton',disabled:model.accountBusy,onClick:requestAccountSignOut},t('signOut')),model.accountTarget);
    }
    const visibleSettingsModal=()=>[...document.querySelectorAll('[data-shortcut-modal="settings"]')].find(node=>!node.closest('.tanuki-settings-window[data-open="false"]'));
    function attach(){
      if(!alive)return;attachAccount();
      const modal=visibleSettingsModal(),settingsOpen=!!modal;
      const toolboxOpen=!!modal?.querySelector('[data-tanuki-settings-icon][aria-current="true"],.tanuki-base-settings');
      const skillsOpen=!!modal?.querySelector('.dssm-section');
      if(state.settingsOpen!==settingsOpen||state.toolboxOpen!==toolboxOpen||state.skillsOpen!==skillsOpen)publish({settingsOpen,toolboxOpen,skillsOpen});
      // Slot names are public anchors; CSS-module suffixes are native implementation dependencies.
      // Match complete class tokens, not arbitrary descendants whose names merely contain "root".
      const hasPart=(node,part)=>node&&[...node.classList].some(name=>name.endsWith('_'+part));
      const slot=document.querySelector('[data-slot="sidebar"]');
      const root=[...(slot?.children||[])].find(node=>hasPart(node,'root'));
      const col=slot?.closest('[class*="_sidebarCol"]'),frame=col?.parentElement;
      if(!hasPart(col,'sidebarCol')){detach();if(state.target)publish({target:null});return;}
      if(current&&current.root===root&&current.host.isConnected){attachWorkspaceControls();attachConversationControls();updateLayout();return;}
      detach();
      if(!root||!col||!frame||!/^([\d.]+)px\s+/.test(frame.style.gridTemplateColumns)){if(state.target)publish({target:null});return;}
      const host=document.createElement('div');host.setAttribute('data-tanuki-rail-host','');col.appendChild(host);
      const observer=new MutationObserver(schedule);observer.observe(frame,{attributes:true,attributeFilter:['style','data-sidebar-collapsed']});
      current={frame,col,root,host,observer,collapsed:frame.hasAttribute('data-sidebar-collapsed')};frame.setAttribute('data-tanuki-shell','');col.setAttribute('data-tanuki-sidebar-col','');root.setAttribute('data-tanuki-sidebar-root','');
      current.splitter=createWorkspaceSplitter({window,document,frame,getWidth:()=>current?.renderedWidth||280,getLimits:widthLimits,label:()=>t('resizeWorkspace'),preview:value=>{previewWidth=value;updateLayout();},commit:saveWidth,clearPreview:()=>{previewWidth=null;updateLayout();}});
      attachWorkspaceControls();attachConversationControls();updateLayout();publish({target:host});
    }
    function schedule(){if(alive){cancelAnimationFrame(frameRequest);frameRequest=requestAnimationFrame(attach);}}
    const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('tanuki:settings-visibility',schedule);
    ctx.effect(()=>{const style=document.createElement('style');style.textContent=__CSS__;document.head.appendChild(style);return()=>style.remove();});
    function openNativeSettings(accountOnly=false){
      if(!alive||!current)return;settingsCleanup?.();
      if(visibleSettingsModal())return;
      if(!accountOnly){const shell=ctx.slots.entriesOfSlot('sidebar.settings').find(entry=>typeof entry.store?.create==='function'),actions=shell?.store.create().actions;if(typeof actions?.open==='function'){actions.open();return;}}
      const root=current.root,slot=root.querySelector('[data-slot="sidebar.settings"]');
      const direct=slot?.querySelector('button[aria-haspopup="dialog"]');if(direct){direct.click();return;}
      const trigger=slot?.querySelector('[data-slot="settings.launcher"] button[aria-haspopup="menu"]');
      if(!trigger){notify('unavailable');return;}
      // Keep the official account component mounted, including its sign-in event subscriptions.
      const existing=new Set(document.querySelectorAll('[role="menu"]')),wasOpen=trigger.getAttribute('aria-expanded')==='true';
      const accountText=ctx.locale.bind('settings.account'),settingsLabels=new Set(['设置','Settings',accountText('settings')]),feedbackLabels=new Set(['意见反馈','Feedback',accountText('contactUs')]);
      root.setAttribute('data-tanuki-settings-anchor','');
      let done=false,menu=null,timeout;
      const cleanup=()=>{if(done)return;done=true;watch.disconnect();clearTimeout(timeout);root.removeAttribute('data-tanuki-settings-anchor');document.removeEventListener('keydown',cancel,true);document.removeEventListener('pointerdown',outside,true);if(settingsCleanup===cleanup)settingsCleanup=null;};
      const cancel=event=>{if(event.key==='Escape')cleanup();};
      const outside=event=>{if(menu&&!menu.contains(event.target))cleanup();};
      const find=()=>{
        if(!alive){cleanup();return;}
        if(menu&&!menu.isConnected){cleanup();return;}
        const candidates=[...document.querySelectorAll('[role="menu"]')].filter(value=>wasOpen||!existing.has(value)).map(value=>{
          const items=[...value.querySelectorAll('button[role="menuitem"]')],label=node=>[...node.querySelectorAll('span')].map(span=>span.textContent.trim()).find(text=>settingsLabels.has(text)||feedbackLabels.has(text));
          const settings=items.filter(item=>settingsLabels.has(label(item)));
          return settings.length===1&&items.some(item=>feedbackLabels.has(label(item)))?{menu:value,button:settings[0]}:null;
        }).filter(Boolean);
        if(candidates.length!==1)return;
        menu=candidates[0].menu;
        if(accountOnly){clearTimeout(timeout);return;}
        candidates[0].button.click();cleanup();
      };
      const watch=new MutationObserver(find);settingsCleanup=cleanup;watch.observe(document.body,{childList:true,subtree:true});document.addEventListener('keydown',cancel,true);document.addEventListener('pointerdown',outside,true);
      timeout=setTimeout(()=>{cleanup();if(alive)notify('unavailable');},2000);
      if(!wasOpen)trigger.click();find();
    }
    function Home(){const tr=useLocale();return h('main',{'aria-label':tr('home'),style:{height:'100%',width:'100%',background:'var(--dsw-alias-bg-base,#151515)'}});}
    ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:HOME,locale:NS},Home));
    const clearHandoff=()=>window.dispatchEvent(new Event('tanuki:clear-handoff'));
    function navigate(panel){clearHandoff();ctx.layout.selectPanel(panel);}
    function openAutomations(){if(hasAutomations())navigate('schedules');else notify('automationsUnavailable');}
    function openSkills(){
      if(!hasSkills())return;
      const shell=ctx.slots.entriesOfSlot('sidebar.settings').find(entry=>typeof entry.store?.create==='function');
      if(shell?.store.create().actions.openSection)shell.store.create().actions.openSection('skills-manager');else notify('unavailable');
    }
    function openToolboxSettings(){
      if(!alive)return;toolboxCleanup?.();
      const shell=ctx.slots.entriesOfSlot('sidebar.settings').find(entry=>typeof entry.store?.create==='function'),actions=shell?.store.create().actions;if(typeof actions?.openSection==='function'){actions.openSection('tanuki-toolbox');return;}
      // The toolbox core marks its own registered native settings navigation entry.
      // Use that real entry, not a guessed settings service or localized native label.
      let timer,watch;
      const cleanup=()=>{watch?.disconnect();clearTimeout(timer);if(toolboxCleanup===cleanup)toolboxCleanup=null;};
      const select=()=>{if(!alive){cleanup();return;}const entry=document.querySelector('[data-shortcut-modal="settings"] [data-tanuki-settings-icon]');if(entry){entry.click();cleanup();}};
      watch=new MutationObserver(select);watch.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-tanuki-settings-icon']});toolboxCleanup=cleanup;
      timer=setTimeout(()=>{cleanup();if(alive)notify('unavailable');},2500);openNativeSettings();select();
    }
    function setVisible(key){
      if(!optionalItems.includes(key))return;
      const visibility={...state.visibility,[key]:!state.visibility[key]};publish({visibility});
      try{localStorage.setItem(visibilityKey,JSON.stringify(visibility));}catch{notify('visibilitySaveFailed');}
    }
    const storageChanged=event=>{if(event.key===visibilityKey||event.key===null)publish({visibility:readVisibility()});if(event.key===orderKey||event.key===legacyOrderKey||event.key===null)publish({order:readOrder()});if(event.key===paneKey||event.key===null){publish({workspaceCollapsed:readCollapsed()});syncPane();}if(event.key===widthKey||event.key===null){current?.splitter?.cancel();preferredWidth=readWidth();updateLayout();}};
    window.addEventListener('storage',storageChanged);
    window.addEventListener('resize',schedule);const offLocale=ctx.locale.subscribe(schedule);
    function newSession(){clearHandoff();ctx.layout.selectPanel(null);try{ctx.get('uiWorkspace').startSession();}catch{notify('unavailable');}}
    async function restart(){
      if(document.documentElement.dataset.platform==='darwin'){notify('restartUnsupported');return;}
      if(!alive||state.restarting)return;publish({restarting:true});
      const controller=new AbortController();requests.add(controller);let accepted=false;const timeout=setTimeout(()=>controller.abort(),30000);
      try{
        const url=new URL('tanuki-toolbox/restart',document.baseURI);
        const response=await fetch(url,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Tanuki-Restart':'1'},body:JSON.stringify({requestId:crypto.randomUUID(),confirmed:true}),signal:controller.signal});
        if(!alive)return;const result=await response.json();if(!alive)return;
        accepted=result.status==='accepted'||result.status==='launched';
        if(!accepted&&result.status!=='cancelled')notify(result.status==='unavailable'?'restartUnavailable':'restartFailed',result.code);
      }catch{if(alive&&!controller.signal.aborted)notify('restartFailed');else if(alive)notify('restartFailed');}
      finally{clearTimeout(timeout);requests.delete(controller);if(alive&&!accepted)publish({restarting:false});}
    }
    const paths={newSession:'M20 11.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6.5M16 3v6M13 6h6',plugins:'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',workspace:'M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 11h18',restart:'M20 7v5h-5M20 12a8 8 0 1 0-2.3 5.7',settings:'M9 3h6l.6 2.4 2.1 1.2 2.4-.7 3 5.2-1.8 1.7v2.4l1.8 1.7-3 5.2-2.4-.7-2.1 1.2L15 24H9l-.6-2.4-2.1-1.2-2.4.7-3-5.2 1.8-1.7v-2.4L.9 11.1l3-5.2 2.4.7 2.1-1.2z'};
    function Icon({name,selected=false}){
      const cutoutId=React.useId();
      const svg={viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true};
      if(name==='skills')return IconSkillOutlineRegular?h(IconSkillOutlineRegular,{size:24}):h('svg',svg,h('path',{d:'M14 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h6M8 7h8M8 12h5M18 13l1.5 3.5L23 18l-3.5 1.5L18 23l-1.5-3.5L13 18l3.5-1.5z'}));
      if(name==='eyeOpen')return h('svg',svg,h('path',{d:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z'}),h('circle',{cx:12,cy:12,r:3}));
      if(name==='eyeClosed')return h('svg',svg,h('path',{d:'M3 9c4 6 14 6 18 0M5 12l-2 3M9 14l-1 3M15 14l1 3M19 12l2 3'}));
      if(name==='home')return h('span',{className:'tanuki-rail-home-mark','aria-hidden':true},h(FishLogo,{size:24}),selected?h('svg',{...svg,className:'tanuki-rail-home-spout',strokeWidth:1.5},h('path',{d:'M7 8V4M7 4C7 2.4 5.8 1.5 4.3 1.5M7 4C7 2.4 8.2 1.5 9.7 1.5'})):null);
      if(name==='automations'){
        const hands='M12 6.5V12l-3 3';
        if(!selected)return h('svg',svg,h('circle',{cx:12,cy:12,r:9.5}),h('path',{d:hands}));
        return h('svg',svg,h('defs',null,h('mask',{id:cutoutId,maskUnits:'userSpaceOnUse',x:0,y:0,width:24,height:24},h('rect',{width:24,height:24,fill:'white',stroke:'none'}),h('path',{d:hands,stroke:'black',strokeWidth:1.8}))),h('circle',{cx:12,cy:12,r:10.35,fill:'currentColor',stroke:'none',mask:'url(#'+cutoutId+')'}));
      }
      if(name==='workspace')return h('svg',svg,selected?h('path',{d:'M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',fill:'currentColor',stroke:'none'}):null,h('path',{d:paths.workspace}));
      if(name==='plugins')return h('svg',svg,h('path',{d:paths.plugins,fill:selected?'currentColor':'none'}));
      if(name==='expandWorkspace')return h('svg',{viewBox:'0 0 12 16',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:'M4 4l4 4-4 4'}));
      if(name==='collapseWorkspace')return h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('rect',{x:3,y:4,width:18,height:16,rx:2}),h('path',{d:'M9 4v16M16 9l-3 3 3 3'}));
      if(name==='more')return h('svg',{viewBox:'0 0 24 24',fill:'currentColor','aria-hidden':true},...[5,12,19].map(cx=>h('circle',{key:cx,cx,cy:12,r:1.7})));
      if(name==='reorder')return h('svg',{viewBox:'0 0 16 24',fill:'currentColor','aria-hidden':true},...[6,12,18].flatMap(cy=>[5,11].map(cx=>h('circle',{key:cx+'-'+cy,cx,cy,r:1.4}))));
      if(name==='toolbox'){
        const handle='M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7',seam='M3 11.5l8 2a4 4 0 0 0 2 0l8-2M10 12.5v3h4v-3';
        if(!selected)return h('svg',svg,h('path',{d:handle+seam}),h('rect',{x:3,y:7,width:18,height:13,rx:2}));
        return h('svg',svg,h('defs',null,h('mask',{id:cutoutId,maskUnits:'userSpaceOnUse',x:0,y:0,width:24,height:24},h('rect',{width:24,height:24,fill:'white',stroke:'none'}),h('path',{d:seam,stroke:'black',strokeWidth:1.5}))),h('path',{d:handle}),h('rect',{x:3,y:7,width:18,height:13,rx:2,fill:'currentColor',mask:'url(#'+cutoutId+')'}));
      }
      if(name==='settings'){
        const gear='m9.5 3-.6 2.1-1.8 1-2.1-.5-2.5 4.3L4 11.5v2l-1.5 1.6L5 19.4l2.1-.5 1.8 1 .6 2.1h5l.6-2.1 1.8-1 2.1.5 2.5-4.3-1.5-1.6v-2l1.5-1.6L19 5.6l-2.1.5-1.8-1L14.5 3z';
        return h('svg',svg,selected?h(React.Fragment,null,h('path',{d:gear+'M15 12.5a3 3 0 1 0-6 0a3 3 0 1 0 6 0z',fill:'currentColor',fillRule:'evenodd',stroke:'none'}),h('path',{d:gear})):h(React.Fragment,null,h('path',{d:gear}),h('circle',{cx:12,cy:12.5,r:3})));
      }
      return h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:paths[name]}));
    }
    function RestartButton({busy}){
      const tr=useLocale(),[progress,setProgress]=React.useState(0);
      const unsupported=document.documentElement.dataset.platform==='darwin';
      const runtime=React.useRef({active:true,held:false,value:0,frame:0,last:0,source:null,fired:false,busy:false});
      const r=runtime.current;r.busy=busy||unsupported;
      function tick(now){
        r.frame=0;if(!r.active||!alive||r.busy)return;
        if(document.hidden){stop(true);return;}
        const elapsed=Math.min(64,Math.max(0,now-r.last));r.last=now;
        r.value=Math.max(0,Math.min(1,r.value+(r.held?1:-1)*elapsed/1000));setProgress(r.value);
        if(r.value>=1&&r.held&&!r.fired){r.fired=true;r.held=false;void restart();return;}
        if(r.held||r.value>0)r.frame=requestAnimationFrame(tick);
      }
      function animate(){if(!r.frame&&r.active&&!r.busy){r.last=performance.now();r.frame=requestAnimationFrame(tick);}}
      function stop(reset=false){r.held=false;r.source=null;if(reset){cancelAnimationFrame(r.frame);r.frame=0;r.value=0;setProgress(0);}else animate();}
      function begin(source){if(!alive||r.busy||r.source!==null||document.hidden)return;r.source=source;r.fired=false;r.held=true;animate();}
      React.useEffect(()=>{r.active=true;const cancel=()=>stop(true);const hidden=()=>{if(document.hidden)cancel();};window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',hidden);return()=>{r.active=false;cancelAnimationFrame(r.frame);window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',hidden);};},[]);
      React.useEffect(()=>{cancelAnimationFrame(r.frame);r.frame=0;r.held=false;r.value=busy?1:0;setProgress(r.value);},[busy]);
      const title=tr(unsupported?'restartUnsupported':'menu_restart');
      return h('button',{type:'button',className:'tanuki-rail-button tanuki-restart-hold',disabled:busy||unsupported,title,'aria-label':title,'aria-description':tr(unsupported?'restartUnsupported':busy?'restarting':'restartHold'),
        onClick:event=>event.preventDefault(),onContextMenu:event=>event.preventDefault(),
        onPointerDown:event=>{if(event.button!==0||!event.isPrimary)return;event.preventDefault();event.currentTarget.focus();begin('p'+event.pointerId);if(r.source==='p'+event.pointerId)event.currentTarget.setPointerCapture(event.pointerId);},
        onPointerUp:event=>{if(r.source==='p'+event.pointerId)stop();},
        onPointerCancel:event=>{if(r.source==='p'+event.pointerId)stop();},
        onLostPointerCapture:event=>{if(r.source==='p'+event.pointerId)stop();},
        onPointerMove:event=>{if(r.source!=='p'+event.pointerId)return;const box=event.currentTarget.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)stop();},
        onKeyDown:event=>{if(event.key!==' '&&event.key!=='Enter')return;event.preventDefault();if(!event.repeat)begin('k'+event.key);},
        onKeyUp:event=>{if(event.key!==' '&&event.key!=='Enter')return;event.preventDefault();if(r.source==='k'+event.key)stop();},onBlur:()=>stop(true)
      },h(Icon,{name:'restart'}),h('svg',{className:'tanuki-restart-ring',viewBox:'0 0 40 40','aria-hidden':true,style:{opacity:progress>0?1:0}},h('circle',{cx:20,cy:20,r:18,pathLength:100,fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeDasharray:100,strokeDashoffset:100*(1-progress),transform:'rotate(-90 20 20)'})));
    }
    function VisibilityMenu({visibility,order,skillsAvailable}){
      const tr=useLocale(),[open,setOpen]=React.useState(false),[position,setPosition]=React.useState({left:52,top:0}),[preview,setPreview]=React.useState(null);
      const anchor=React.useRef(null),menu=React.useRef(null),drag=React.useRef(null),pendingFocus=React.useRef(null),menuId=React.useId();
      function finish(commit=false,focus=true){
        const active=drag.current;if(!active)return;
        drag.current=null;cancelAnimationFrame(active.frame);
        if(active.node.hasPointerCapture(active.id))active.node.releasePointerCapture(active.id);
        if(!alive)return;
        setPreview(null);
        if(focus){pendingFocus.current=active.key;active.node.focus({preventScroll:true});}
        if(commit&&active.started&&active.target&&active.order===state.order)moveItem(active.key,active.target.group,active.target.index);
      }
      const close=()=>{finish(false,false);setOpen(false);anchor.current?.focus({preventScroll:true});};
      function locate(active){
        const popup=menu.current;if(!popup)return;
        const box=popup.getBoundingClientRect();let target=null;
        if(active.x>=box.left&&active.x<=box.right&&active.y>=box.top&&active.y<=box.bottom){
          const divider=popup.querySelector('[role="separator"]').getBoundingClientRect();
          const group=active.y<divider.top+divider.height/2?'top':'bottom';
          const rows=[...popup.querySelectorAll('[data-sort-group="'+group+'"] [data-sort-key]')].filter(row=>row.dataset.sortKey!==active.key);
          let index=rows.findIndex(row=>{const bounds=row.getBoundingClientRect();return active.y<bounds.top+bounds.height/2;});
          if(index<0)index=rows.length;
          target={group,index,before:rows[index]?.dataset.sortKey||null};
        }
        active.target=target;
        setPreview(previous=>previous?.key===active.key&&previous?.target?.group===target?.group&&previous?.target?.index===target?.index?previous:{key:active.key,target});
      }
      function scrollSpeed(active){
        const popup=menu.current;if(!popup)return 0;
        const box=popup.getBoundingClientRect();
        if(active.x<box.left||active.x>box.right||active.y<box.top||active.y>box.bottom)return 0;
        if(active.y<box.top+30&&popup.scrollTop>0)return -Math.max(2,(box.top+30-active.y)/3);
        if(active.y>box.bottom-30&&popup.scrollTop+popup.clientHeight<popup.scrollHeight-1)return Math.max(2,(active.y-box.bottom+30)/3);
        return 0;
      }
      function scrollTick(now){
        const active=drag.current;if(!active||!alive)return;active.frame=0;
        const speed=scrollSpeed(active);if(!speed)return;
        const elapsed=active.last?Math.min(32,now-active.last):16;active.last=now;
        menu.current.scrollTop+=speed*elapsed/16;locate(active);
        if(scrollSpeed(active))active.frame=requestAnimationFrame(scrollTick);
      }
      function pointerMove(event){
        const active=drag.current;if(!active||event.pointerId!==active.id)return;
        active.x=event.clientX;active.y=event.clientY;
        if(!active.started&&Math.hypot(active.x-active.startX,active.y-active.startY)<4)return;
        active.started=true;event.preventDefault();locate(active);
        if(scrollSpeed(active)){if(!active.frame){active.last=0;active.frame=requestAnimationFrame(scrollTick);}}
        else{cancelAnimationFrame(active.frame);active.frame=0;}
      }
      function begin(event,key){
        if(!alive||event.button!==0||!event.isPrimary||drag.current)return;
        event.preventDefault();event.stopPropagation();event.currentTarget.focus({preventScroll:true});
        const active={key,id:event.pointerId,node:event.currentTarget,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,started:false,target:null,order:state.order,frame:0,last:0};
        drag.current=active;
        try{active.node.setPointerCapture(active.id);}catch{finish(false);}
      }
      function reorderWithKeyboard(event,key){
        if(!event.altKey||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
        event.preventDefault();event.stopPropagation();finish(false,false);
        const source=order.top.includes(key)?'top':'bottom',index=order[source].indexOf(key);
        const group=event.key==='ArrowLeft'?'top':event.key==='ArrowRight'?'bottom':source;
        const next=group!==source?order[group].length:index+(event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:0);
        pendingFocus.current=key;moveItem(key,group,next);
      }
      React.useLayoutEffect(()=>{
        if(!open)return;
        if(drag.current&&drag.current.order!==order)finish(false);
        const place=()=>{const box=anchor.current?.getBoundingClientRect(),popup=menu.current;if(!box||!popup)return;setPosition(previous=>{
          const safeTop=document.documentElement.hasAttribute('data-fullscreen')?8:8+(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dsh-frame-top-clearance'))||(document.documentElement.dataset.platform==='darwin'?48:0));
          const left=Math.max(4,Math.min(box.right+8,window.innerWidth-popup.offsetWidth-8)),top=Math.max(safeTop,Math.min(box.top,window.innerHeight-popup.offsetHeight-8));
          return previous.left===left&&previous.top===top?previous:{left,top};
        });};
        place();window.addEventListener('resize',place);document.addEventListener('scroll',place,true);
        return()=>{window.removeEventListener('resize',place);document.removeEventListener('scroll',place,true);};
      },[open,visibility,order,tr('more')]);
      React.useLayoutEffect(()=>{
        if(!open)return;
        const cancel=()=>finish(false,false),hidden=()=>{if(document.hidden)cancel();};
        const outside=event=>{if(!anchor.current?.contains(event.target)&&!menu.current?.contains(event.target)){cancel();setOpen(false);}};
        const cleanup=()=>{cancel();window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',hidden);document.removeEventListener('pointerdown',outside,true);if(menuCleanup===cleanup)menuCleanup=null;};
        menuCleanup=cleanup;window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',hidden);document.addEventListener('pointerdown',outside,true);
        menu.current?.querySelector('[role="menuitemcheckbox"]')?.focus({preventScroll:true});
        return cleanup;
      },[open]);
      React.useLayoutEffect(()=>{
        if(!open||!pendingFocus.current)return;
        const handle=menu.current?.querySelector('[data-sort-key="'+pendingFocus.current+'"] .tanuki-rail-sort-handle');
        if(handle){pendingFocus.current=null;handle.focus({preventScroll:true});handle.scrollIntoView({block:'nearest'});}
      });
      const keydown=event=>{
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(drag.current)finish(false);else close();return;}
        if(event.key==='Tab'){finish(false,false);setOpen(false);anchor.current?.focus({preventScroll:true});return;}
        const row=event.target.closest('[data-sort-key]');
        if(['ArrowLeft','ArrowRight'].includes(event.key)&&row){event.preventDefault();row.querySelector(event.key==='ArrowLeft'?'.tanuki-rail-sort-handle':'.tanuki-rail-menu-item')?.focus();return;}
        if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();
        const rows=[...menu.current.querySelectorAll('[data-sort-key]')],index=rows.indexOf(row);
        const next=event.key==='Home'?0:event.key==='End'?rows.length-1:(index+(event.key==='ArrowDown'?1:rows.length-1))%rows.length;
        rows[next]?.querySelector(event.target.closest('.tanuki-rail-sort-handle')?'.tanuki-rail-sort-handle':'.tanuki-rail-menu-item')?.focus();
      };
      const section=group=>h('div',{key:group,role:'group','aria-label':tr('order_'+group),'data-sort-group':group,className:'tanuki-rail-menu-group'},
        h('div',{className:'tanuki-rail-sort-list','data-drop-end':preview?.target?.group===group&&!preview.target.before?'true':undefined},
          ...order[group].map(key=>{
            const required=!optionalItems.includes(key),unavailable=key==='skills'&&!skillsAvailable,visible=!unavailable&&(required||visibility[key]);
            return h('div',{key,role:'none','data-sort-key':key,'data-dragging':preview?.key===key?'true':undefined,'data-drop-before':preview?.target?.group===group&&preview.target.before===key?'true':undefined,className:'tanuki-rail-menu-row'},
              h('button',{type:'button',role:'menuitem',tabIndex:-1,className:'tanuki-rail-sort-handle',title:tr('reorderHint'),'aria-label':tr('reorder')+' '+tr('menu_'+key),'aria-description':tr('reorderHint'),
                onPointerDown:event=>begin(event,key),onPointerMove:pointerMove,
                onPointerUp:event=>{if(drag.current?.id===event.pointerId){if(drag.current.started){drag.current.x=event.clientX;drag.current.y=event.clientY;locate(drag.current);}finish(true);}},
                onPointerCancel:event=>{if(drag.current?.id===event.pointerId)finish(false);},onLostPointerCapture:event=>{if(drag.current?.id===event.pointerId)finish(false);},
                onKeyDown:event=>reorderWithKeyboard(event,key),onClick:event=>{event.preventDefault();event.stopPropagation();}},h(Icon,{name:'reorder'})),
              h('button',{type:'button',role:'menuitemcheckbox','aria-checked':visible,'aria-disabled':required||unavailable||undefined,'data-unavailable':unavailable||undefined,title:tr(unavailable?'skillsUnavailable':required?'alwaysVisible':visible?'visibilityShown':'visibilityHidden'),tabIndex:-1,className:'tanuki-rail-menu-item',onClick:()=>{if(!required&&!unavailable)setVisible(key);}},
                h(Icon,{name:key}),h('span',{className:'tanuki-rail-menu-label'},tr('menu_'+key)),h('span',{className:'tanuki-rail-menu-status','data-locked':required||unavailable?'true':undefined,'aria-hidden':true},h(Icon,{name:visible?'eyeOpen':'eyeClosed'}))));
          }),order[group].length?null:h('div',{className:'tanuki-rail-drop-empty'},tr('dropHere'))));
      return h(React.Fragment,null,h('button',{ref:anchor,type:'button',className:'tanuki-rail-button',title:tr('more'),'aria-label':tr('more'),'aria-haspopup':'menu','aria-expanded':open,'aria-controls':open?menuId:undefined,onClick:()=>{if(open)close();else setOpen(true);},onKeyDown:event=>{if(event.key==='ArrowDown'){event.preventDefault();setOpen(true);}}},h(Icon,{name:'more'})),
        open?createPortal(h('div',{id:menuId,ref:menu,role:'menu','aria-label':tr('more'),className:'tanuki-rail-menu',style:position,onKeyDown:keydown},section('top'),h('hr',{role:'separator',className:'tanuki-rail-menu-divider'}),section('bottom')),document.body):null);
    }
    function Rail(props){
      const tr=useLocale(),model=React.useSyncExternalStore(subscribe,()=>state),panel=props.useSidebarPanel(s=>s.activePanelId);
      const expandButton=React.useRef(null),collapseButton=React.useRef(null);
      React.useLayoutEffect(()=>{
        if(!focusWorkspaceToggle)return;
        const target=focusWorkspaceToggle==='expand'?expandButton.current:collapseButton.current;
        if(target){focusWorkspaceToggle=null;target.focus();}
      },[model.pane,model.workspaceTarget,model.conversationTarget,model.target]);
      if(!model.target)return null;
      const button=(key,action,selected,extra={})=>h('button',{key,type:'button',className:'tanuki-rail-button'+(key==='home'?' tanuki-rail-home':''),title:tr('menu_'+key),'aria-label':tr('menu_'+key),'aria-current':selected?'page':undefined,'data-tanuki-bubble-target':['plugins','workspace','settings'].includes(key)?key:undefined,onClick:action,...extra},h(Icon,{name:key,selected}));
      const item=key=>{
        if(optionalItems.includes(key)&&!model.visibility[key])return null;
        switch(key){
          case 'home':return button(key,()=>navigate(ctx.slots.entries('main').some(entry=>entry.options?.key==='tanuki-home')?'tanuki-home':HOME),panel===HOME||panel==='tanuki-home');
          case 'newSession':return button(key,newSession,false);
          case 'workspace':return button(key,openWorkspace,panel===null,{'aria-expanded':model.pane});
          case 'more':return h(VisibilityMenu,{key,visibility:model.visibility,order:model.order,skillsAvailable:model.skillsAvailable});
          case 'skills':return model.skillsAvailable?button(key,openSkills,model.skillsOpen,{'aria-haspopup':'dialog','aria-expanded':model.skillsOpen}):null;
          case 'automations':return button(key,openAutomations,panel==='schedules',{disabled:!model.automationsAvailable,title:tr(model.automationsAvailable?'menu_automations':'automationsUnavailable')});
          case 'toolbox':return button(key,openToolboxSettings,model.toolboxOpen,{'aria-haspopup':'dialog','aria-expanded':model.toolboxOpen});
          case 'plugins':return button(key,()=>navigate('plugins'),panel==='plugins');
          case 'settings':return button(key,()=>openNativeSettings(),model.settingsOpen,{'aria-haspopup':'dialog','aria-expanded':model.settingsOpen,onContextMenu:event=>{event.preventDefault();openNativeSettings(true);},'aria-description':tr('settingsHint')});
          case 'restart':return h(RestartButton,{key,busy:model.restarting});
          default:return null;
        }
      };
      // One keyed sibling list preserves the open menu when its own icon crosses groups.
      const railItems=[...model.order.top.map(item),h('div',{key:'spacer',className:'tanuki-rail-spacer'}),...model.order.bottom.map(item)];
      return createPortal(h(React.Fragment,null,
        h('nav',{className:'tanuki-rail','aria-label':tr('rail')},railItems),
        h('div',{className:'tanuki-workspace-heading','aria-hidden':!model.pane},h('span',null,tr('workspace'))),
        model.workspaceTarget?createPortal(h('button',{ref:collapseButton,type:'button',className:'tanuki-workspace-collapse',title:tr('collapseWorkspace'),'aria-label':tr('collapseWorkspace'),'aria-expanded':model.pane,disabled:!model.pane,tabIndex:model.pane?0:-1,onClick:()=>setWorkspaceCollapsed(true,true)},h(Icon,{name:'collapseWorkspace'})),model.workspaceTarget):null,
        model.conversationTarget&&panel===null?createPortal(h('button',{ref:expandButton,type:'button',className:'tanuki-workspace-collapse tanuki-workspace-expand','data-visible':!model.pane,title:tr('expandWorkspace'),'aria-label':tr('expandWorkspace'),'aria-expanded':model.pane,'aria-hidden':model.pane,disabled:model.pane,tabIndex:model.pane?-1:0,onClick:()=>setWorkspaceCollapsed(false,true)},h(Icon,{name:'expandWorkspace'})),model.conversationTarget):null),model.target);
    }
    ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'tanuki-sidebar',locale:NS,inject:()=>({hooks:{sidebarPanel:ctx.layout.panelInfo}})},Rail));
    ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'tanuki-sidebar-account-signout',locale:NS},AccountSignOut));
    const offPanel=ctx.layout.panelInfo.subscribe(syncPane);
    const offMain=ctx.slots.subscribe('main',()=>{const available=hasAutomations();if(state.automationsAvailable!==available)publish({automationsAvailable:available});});
    const offSkills=ctx.slots.subscribe('settings.section',()=>{const available=hasSkills();if(state.skillsAvailable!==available)publish({skillsAvailable:available});});
    syncPane();attach();
    ctx.effect(()=>()=>{alive=false;offPanel();offMain();offSkills();observer.disconnect();cancelAnimationFrame(frameRequest);for(const request of requests)request.abort();requests.clear();
      window.removeEventListener('storage',storageChanged);window.removeEventListener('resize',schedule);window.removeEventListener('tanuki:settings-visibility',schedule);offLocale();menuCleanup?.();toolboxCleanup?.();settingsCleanup?.();detachAccount();detach();listeners.clear();
      if(lifecycle.disabled&&ctx.layout.panelInfo.getSnapshot().activePanelId===HOME)ctx.layout.selectPanel(null);
    });
  }
  return {name:'tanuki-sidebar-runtime',inject:['slots','locale','layout','uiWorkspace'],apply};
});
