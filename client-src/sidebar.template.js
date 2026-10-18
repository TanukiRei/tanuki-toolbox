document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),h=React.createElement,{createPortal}=require('react-dom');
  const {FishLogo}=require('@deepseek-ai/dsh-client-ui-primitives'),NS='tanukiSidebar',HOME='tanuki-sidebar-home';
  function apply(ctx,{lifecycle}){
    let alive=true,current=null,frameRequest=null,settingsCleanup=null,toolboxCleanup=null,accountMount=null,accountCleanup=null;
    const visibilityKey='tanuki.sidebar.visibility.v1',paneKey='tanuki.sidebar.workspace-collapsed.v1',optionalItems=['workspace','automations','toolbox','plugins','restart'];
    function readCollapsed(){try{return localStorage.getItem(paneKey)==='true';}catch{return false;}}
    const hasAutomations=()=>ctx.slots.entriesOfSlot('main').some(entry=>entry.options?.key==='schedules');
    function readVisibility(){try{const saved=JSON.parse(localStorage.getItem(visibilityKey)||'{}');return Object.fromEntries(optionalItems.map(key=>[key,saved?.[key]!==false]));}catch{return Object.fromEntries(optionalItems.map(key=>[key,true]));}}
    const listeners=new Set(),requests=new Set();let focusWorkspaceToggle=null,state={target:null,workspaceTarget:null,conversationTarget:null,accountTarget:null,accountBusy:false,workspaceCollapsed:readCollapsed(),pane:ctx.layout.panelInfo.getSnapshot().activePanelId===null&&!readCollapsed(),automationsAvailable:hasAutomations(),restarting:false,settingsOpen:false,visibility:readVisibility()};
    const publish=next=>{if(!alive)return;state={...state,...next};for(const fn of listeners)fn();};
    const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
    ctx.effect(()=>ctx.locale.register(NS,__LOCALES__));const t=ctx.locale.bind(NS);
    const notify=(key,code)=>{const suffix=typeof code==='string'&&/^[A-Z_]{1,80}$/.test(code)?' ['+code+']':'';window.dispatchEvent(new CustomEvent('tanuki:notify',{detail:{kind:'error',title:{zh:'侧边栏',en:'Sidebar'},message:{zh:__LOCALES__.zh[key]+suffix,en:__LOCALES__.en[key]+suffix}}}));};
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
      const paneWidth=current.paneWidth||280,left=state.pane?paneWidth+52:52;
      const columns=left+'px '+match[2];
      if(frame.style.getPropertyValue('--tanuki-shell-columns')!==columns)frame.style.setProperty('--tanuki-shell-columns',columns);
      if(frame.style.getPropertyValue('--tanuki-left-width')!==left+'px')frame.style.setProperty('--tanuki-left-width',left+'px');
      if(frame.style.getPropertyValue('--tanuki-workspace-width')!==paneWidth+'px')frame.style.setProperty('--tanuki-workspace-width',paneWidth+'px');
      const mode=state.pane?'open':'closed';if(frame.getAttribute('data-tanuki-workspace')!==mode)frame.setAttribute('data-tanuki-workspace',mode);
      if(root.getAttribute('data-tanuki-sidebar-root')!=='')root.setAttribute('data-tanuki-sidebar-root','');
      syncWorkspaceInteraction();
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
      return createPortal(h('button',{type:'button',className:'_8RVnMG_linkButton',disabled:model.accountBusy,onClick:requestAccountSignOut},ctx.locale.bind('settings.account')('signOut')),model.accountTarget);
    }
    function attach(){
      if(!alive)return;attachAccount();
      const settingsOpen=!!document.querySelector('[data-shortcut-modal="settings"]');if(state.settingsOpen!==settingsOpen)publish({settingsOpen});
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
      attachWorkspaceControls();attachConversationControls();updateLayout();publish({target:host});
    }
    function schedule(){if(alive){cancelAnimationFrame(frameRequest);frameRequest=requestAnimationFrame(attach);}}
    const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});
    ctx.effect(()=>{const style=document.createElement('style');style.textContent=__CSS__;document.head.appendChild(style);return()=>style.remove();});
    function openNativeSettings(accountOnly=false){
      if(!alive||!current)return;settingsCleanup?.();
      if(document.querySelector('[data-shortcut-modal="settings"]'))return;
      const root=current.root,slot=root.querySelector('[data-slot="sidebar.settings"]');
      const direct=slot?.querySelector('button[aria-haspopup="dialog"]');if(direct){direct.click();return;}
      const trigger=slot?.querySelector('[data-slot="settings.launcher"] button[aria-haspopup="menu"]');
      if(!trigger){notify('unavailable');return;}
      // Keep the official account component mounted, including its sign-in event subscriptions.
      const existing=new Set(document.querySelectorAll('[role="menu"]')),wasOpen=trigger.getAttribute('aria-expanded')==='true';
      root.setAttribute('data-tanuki-settings-anchor','');
      let done=false,menu=null,timeout;
      const cleanup=()=>{if(done)return;done=true;watch.disconnect();clearTimeout(timeout);root.removeAttribute('data-tanuki-settings-anchor');document.removeEventListener('keydown',cancel,true);document.removeEventListener('pointerdown',outside,true);if(settingsCleanup===cleanup)settingsCleanup=null;};
      const cancel=event=>{if(event.key==='Escape')cleanup();};
      const outside=event=>{if(menu&&!menu.contains(event.target))cleanup();};
      const find=()=>{
        if(!alive){cleanup();return;}
        if(menu&&!menu.isConnected){cleanup();return;}
        const candidates=[...document.querySelectorAll('[role="menu"]')].filter(value=>wasOpen||!existing.has(value)).map(value=>{
          const items=[...value.querySelectorAll('button[role="menuitem"]')],label=node=>[...node.querySelectorAll('span')].map(span=>span.textContent.trim()).find(text=>['设置','Settings','意见反馈','Feedback'].includes(text));
          const settings=items.filter(item=>['设置','Settings'].includes(label(item)));
          return settings.length===1&&items.some(item=>['意见反馈','Feedback'].includes(label(item)))?{menu:value,button:settings[0]}:null;
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
    function openToolboxSettings(){
      if(!alive)return;toolboxCleanup?.();
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
    const storageChanged=event=>{if(event.key===visibilityKey||event.key===null)publish({visibility:readVisibility()});if(event.key===paneKey||event.key===null){publish({workspaceCollapsed:readCollapsed()});syncPane();}};
    window.addEventListener('storage',storageChanged);
    function newSession(){clearHandoff();ctx.layout.selectPanel(null);try{ctx.get('uiWorkspace').startSession();}catch{notify('unavailable');}}
    async function restart(){
      if(!alive||state.restarting)return;publish({restarting:true});
      const controller=new AbortController();requests.add(controller);let accepted=false,timeout=setTimeout(()=>controller.abort(),15000);
      try{
        const url=new URL('tanuki-toolbox/restart',document.baseURI);
        const capability=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
        if(!alive)return;
        const availability=await capability.json();
        if(!capability.ok||availability.available!==true){if(alive)notify('restartUnavailable',availability.code);return;}
        if(!alive)return;clearTimeout(timeout);timeout=setTimeout(()=>controller.abort(),120000);
        const response=await fetch(url,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Tanuki-Restart':'1'},body:JSON.stringify({requestId:crypto.randomUUID(),confirmed:true}),signal:controller.signal});
        if(!alive)return;const result=await response.json();if(!alive)return;
        accepted=result.status==='accepted';
        if(!accepted&&result.status!=='cancelled')notify(result.status==='unavailable'?'restartUnavailable':'restartFailed',result.code);
      }catch{if(alive&&!controller.signal.aborted)notify('restartFailed');else if(alive)notify('restartFailed');}
      finally{clearTimeout(timeout);requests.delete(controller);if(alive&&!accepted)publish({restarting:false});}
    }
    const paths={newSession:'M20 11.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6.5M16 3v6M13 6h6',plugins:'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',workspace:'M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 11h18',restart:'M20 7v5h-5M20 12a8 8 0 1 0-2.3 5.7',settings:'M9 3h6l.6 2.4 2.1 1.2 2.4-.7 3 5.2-1.8 1.7v2.4l1.8 1.7-3 5.2-2.4-.7-2.1 1.2L15 24H9l-.6-2.4-2.1-1.2-2.4.7-3-5.2 1.8-1.7v-2.4L.9 11.1l3-5.2 2.4.7 2.1-1.2z'};
    function Icon({name}){
      if(name==='home')return h(FishLogo,{size:24});
      if(name==='automations')return h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('circle',{cx:12,cy:12,r:8.5}),h('path',{d:'M12 7v5l3 2M18 3v4h-4'}));
      if(name==='expandWorkspace')return h('svg',{viewBox:'0 0 12 16',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:'M4 4l4 4-4 4'}));
      if(name==='collapseWorkspace')return h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('rect',{x:3,y:4,width:18,height:16,rx:2}),h('path',{d:'M9 4v16M16 9l-3 3 3 3'}));
      if(name==='more')return h('svg',{viewBox:'0 0 24 24',fill:'currentColor','aria-hidden':true},...[5,12,19].map(cx=>h('circle',{key:cx,cx,cy:12,r:1.7})));
      if(name==='toolbox')return h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:'M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7M3 11.5l8 2a4 4 0 0 0 2 0l8-2M10 12.5v3h4v-3'}),h('rect',{x:3,y:7,width:18,height:13,rx:2}));
      if(name==='settings')return h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:'m9.5 3-.6 2.1-1.8 1-2.1-.5-2.5 4.3L4 11.5v2l-1.5 1.6L5 19.4l2.1-.5 1.8 1 .6 2.1h5l.6-2.1 1.8-1 2.1.5 2.5-4.3-1.5-1.6v-2l1.5-1.6L19 5.6l-2.1.5-1.8-1L14.5 3z'}),h('circle',{cx:12,cy:12.5,r:3}));
      return h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:paths[name]}));
    }
    function RestartButton({busy}){
      const tr=useLocale(),[progress,setProgress]=React.useState(0);
      const runtime=React.useRef({active:true,held:false,value:0,frame:0,last:0,source:null,fired:false,busy:false});
      const r=runtime.current;r.busy=busy;
      function tick(now){
        r.frame=0;if(!r.active||!alive||r.busy)return;
        if(document.hidden){stop(true);return;}
        const elapsed=Math.min(64,Math.max(0,now-r.last));r.last=now;
        r.value=Math.max(0,Math.min(1,r.value+(r.held?1:-1)*elapsed/2000));setProgress(r.value);
        if(r.value>=1&&r.held&&!r.fired){r.fired=true;r.held=false;void restart();return;}
        if(r.held||r.value>0)r.frame=requestAnimationFrame(tick);
      }
      function animate(){if(!r.frame&&r.active&&!r.busy){r.last=performance.now();r.frame=requestAnimationFrame(tick);}}
      function stop(reset=false){r.held=false;r.source=null;if(reset){cancelAnimationFrame(r.frame);r.frame=0;r.value=0;setProgress(0);}else animate();}
      function begin(source){if(!alive||r.busy||r.source!==null||document.hidden)return;r.source=source;r.fired=false;r.held=true;animate();}
      React.useEffect(()=>{r.active=true;const cancel=()=>stop(true);const hidden=()=>{if(document.hidden)cancel();};window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',hidden);return()=>{r.active=false;cancelAnimationFrame(r.frame);window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',hidden);};},[]);
      React.useEffect(()=>{cancelAnimationFrame(r.frame);r.frame=0;r.held=false;r.value=busy?1:0;setProgress(r.value);},[busy]);
      const title=tr('menu_restart');
      return h('button',{type:'button',className:'tanuki-rail-button tanuki-restart-hold',disabled:busy,title,'aria-label':title,'aria-description':tr(busy?'restarting':'restartHold'),
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
    function VisibilityMenu({visibility}){
      const tr=useLocale(),[open,setOpen]=React.useState(false),[position,setPosition]=React.useState({left:52,top:0}),anchor=React.useRef(null),menu=React.useRef(null),menuId=React.useId();
      const keys=optionalItems;
      const close=()=>{setOpen(false);anchor.current?.focus();};
      React.useLayoutEffect(()=>{
        if(!open)return;
        const place=()=>{const box=anchor.current?.getBoundingClientRect(),popup=menu.current;if(!box||!popup)return;setPosition({left:Math.max(4,Math.min(box.right+8,window.innerWidth-popup.offsetWidth-8)),top:Math.max(4,Math.min(box.top,window.innerHeight-popup.offsetHeight-8))});};
        const outside=event=>{if(!anchor.current?.contains(event.target)&&!menu.current?.contains(event.target))setOpen(false);};
        place();
        window.addEventListener('resize',place);document.addEventListener('scroll',place,true);document.addEventListener('pointerdown',outside,true);
        return()=>{window.removeEventListener('resize',place);document.removeEventListener('scroll',place,true);document.removeEventListener('pointerdown',outside,true);};
      },[open,visibility]);
      React.useLayoutEffect(()=>{if(open)menu.current?.querySelector('[role="menuitemcheckbox"]')?.focus();},[open]);
      const keydown=event=>{
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
        if(event.key==='Tab'){setOpen(false);return;}
        if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();
        const rows=[...menu.current.querySelectorAll('[role="menuitemcheckbox"]')],index=rows.indexOf(document.activeElement);
        const next=event.key==='Home'?0:event.key==='End'?rows.length-1:(index+(event.key==='ArrowDown'?1:rows.length-1))%rows.length;rows[next]?.focus();
      };
      return h(React.Fragment,null,h('button',{ref:anchor,type:'button',className:'tanuki-rail-button',title:tr('more'),'aria-label':tr('more'),'aria-haspopup':'menu','aria-expanded':open,'aria-controls':open?menuId:undefined,onClick:()=>setOpen(value=>!value),onKeyDown:event=>{if(event.key==='ArrowDown'){event.preventDefault();setOpen(true);}}},h(Icon,{name:'more'})),
        open?createPortal(h('div',{id:menuId,ref:menu,role:'menu','aria-label':tr('more'),className:'tanuki-rail-menu',style:position,onKeyDown:keydown},...keys.map(key=>{
          const visible=visibility[key];
          return h('button',{key,type:'button',role:'menuitemcheckbox','aria-checked':visible,tabIndex:-1,className:'tanuki-rail-menu-item',onClick:()=>setVisible(key)},h(Icon,{name:key}),h('span',{className:'tanuki-rail-menu-label'},tr('menu_'+key)),h('span',{className:'tanuki-rail-menu-status','aria-hidden':true},visible?'✓':''));
        })),document.body):null);
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
      const button=(key,action,selected,extra={})=>h('button',{key,type:'button',className:'tanuki-rail-button'+(key==='home'?' tanuki-rail-home':''),title:tr('menu_'+key),'aria-label':tr('menu_'+key),'aria-current':selected?'page':undefined,'data-tanuki-bubble-target':key==='plugins'||key==='workspace'?key:undefined,onClick:action,...extra},h(Icon,{name:key}));
      return createPortal(h(React.Fragment,null,
        h('nav',{className:'tanuki-rail','aria-label':tr('rail')},
          button('home',()=>navigate(HOME),panel===HOME||panel==='tanuki-home'),
          button('newSession',newSession,false),
          model.visibility.workspace?button('workspace',openWorkspace,panel===null,{'aria-expanded':model.pane}):null,
          h(VisibilityMenu,{visibility:model.visibility}),
          h('div',{className:'tanuki-rail-spacer'}),
          model.visibility.automations?button('automations',openAutomations,panel==='schedules',{disabled:!model.automationsAvailable,title:tr(model.automationsAvailable?'menu_automations':'automationsUnavailable')}):null,
          model.visibility.toolbox?button('toolbox',openToolboxSettings,false,{'aria-haspopup':'dialog'}):null,
          model.visibility.plugins?button('plugins',()=>navigate('plugins'),panel==='plugins'):null,
          button('settings',()=>openNativeSettings(),model.settingsOpen,{'aria-haspopup':'dialog','aria-expanded':model.settingsOpen,onContextMenu:event=>{event.preventDefault();openNativeSettings(true);},'aria-description':tr('settingsHint')}),
          model.visibility.restart?h(RestartButton,{busy:model.restarting}):null),
        h('div',{className:'tanuki-workspace-heading','aria-hidden':!model.pane},h('span',null,tr('workspace'))),
        model.workspaceTarget?createPortal(h('button',{ref:collapseButton,type:'button',className:'tanuki-workspace-collapse',title:tr('collapseWorkspace'),'aria-label':tr('collapseWorkspace'),'aria-expanded':model.pane,disabled:!model.pane,tabIndex:model.pane?0:-1,onClick:()=>setWorkspaceCollapsed(true,true)},h(Icon,{name:'collapseWorkspace'})),model.workspaceTarget):null,
        model.conversationTarget&&panel===null?createPortal(h('button',{ref:expandButton,type:'button',className:'tanuki-workspace-collapse tanuki-workspace-expand','data-visible':!model.pane,title:tr('expandWorkspace'),'aria-label':tr('expandWorkspace'),'aria-expanded':model.pane,'aria-hidden':model.pane,disabled:model.pane,tabIndex:model.pane?-1:0,onClick:()=>setWorkspaceCollapsed(false,true)},h(Icon,{name:'expandWorkspace'})),model.conversationTarget):null),model.target);
    }
    ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'tanuki-sidebar',locale:NS,inject:()=>({hooks:{sidebarPanel:ctx.layout.panelInfo}})},Rail));
    ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'tanuki-sidebar-account-signout',locale:NS},AccountSignOut));
    const offPanel=ctx.layout.panelInfo.subscribe(syncPane);
    const offMain=ctx.slots.subscribe('main',()=>{const available=hasAutomations();if(state.automationsAvailable!==available)publish({automationsAvailable:available});});
    syncPane();attach();
    ctx.effect(()=>()=>{alive=false;offPanel();offMain();observer.disconnect();cancelAnimationFrame(frameRequest);for(const request of requests)request.abort();requests.clear();
      window.removeEventListener('storage',storageChanged);toolboxCleanup?.();settingsCleanup?.();detachAccount();detach();listeners.clear();
      if(lifecycle.disabled&&ctx.layout.panelInfo.getSnapshot().activePanelId===HOME)ctx.layout.selectPanel(null);
    });
  }
  return {name:'tanuki-sidebar-runtime',inject:['slots','locale','layout','uiWorkspace'],apply};
});
