document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),h=React.createElement,NS='tanukiHome';
  const empty={},emptyMap=new Map(),noop=()=>()=>{};
  const dateRange=()=>Array.from({length:8},(_,i)=>{const day=new Date();day.setHours(0,0,0,0);day.setDate(day.getDate()+i-6);return +day;});
  function Icon({name}){return h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:{refresh:'M20 7v5h-5M20 12a8 8 0 1 0-2.3 5.7',chat:'M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 3V6a2 2 0 0 1 2-2Z',bolt:'M13 2 4 14h7l-1 8 10-13h-7l1-7Z',tokens:'M12 3 3 8v8l9 5 9-5V8l-9-5Zm0 10v8M3 8l9 5 9-5',arrow:'m9 5 7 7-7 7',plus:'M12 4v16M4 12h16',clock:'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',plugins:'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',settings:'M4 7h16M4 17h16M9 4v6M15 14v6',calendar:'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4'}[name]}));}
  function apply(ctx,{lifecycle}){
    const HOME='tanuki-home';
    const toolboxLocale=(__LOCALE_FACTORY__)(ctx,NS,__LOCALES__),t=toolboxLocale.t;
    let alive=true;
    ctx.effect(()=>{const style=document.createElement('style');style.textContent=__CSS__;document.head.appendChild(style);return()=>{alive=false;style.remove();};});
    function settings(section){const entry=ctx.slots.entries('sidebar.settings').find(row=>typeof row.store?.create==='function');entry?.store.create().actions.openSection(section);}
    function Home(){
      React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());
      const locale=toolboxLocale.language()==='zh'?'zh-CN':'en-US',panel=React.useSyncExternalStore(fn=>ctx.layout.panelInfo.subscribe(fn),()=>ctx.layout.panelInfo.getSnapshot()),active=panel.activePanelId===HOME;
      const sections=React.useSyncExternalStore(fn=>ctx.slots.subscribe('settings.section',fn),()=>ctx.slots.entries('settings.section'));
      const codex=sections.find(entry=>entry.options?.id==='codex-subscription');
      const list=ctx.get('sessions')?.list,status=ctx.get('uiSession')?.sessionStatus;
      const sessions=React.useSyncExternalStore(list?fn=>list.subscribe(fn):noop,()=>list?.getSnapshot()||empty),statuses=React.useSyncExternalStore(status?fn=>status.subscribe(fn):noop,()=>status?.getSnapshot()||emptyMap);
      const [data,setData]=React.useState(null),[error,setError]=React.useState(false),[busy,setBusy]=React.useState(false),[generation,setGeneration]=React.useState(0),[now,setNow]=React.useState(()=>new Date()),[quota,setQuota]=React.useState({phase:'loading'});
      React.useEffect(()=>{
        if(!active)return;let mounted=true,request=null,quotaRequest=null,last=0,midnight;
        const valid=()=>alive&&mounted;
        async function load(){
          if(document.hidden)return;last=Date.now();request?.abort();quotaRequest?.abort();const controller=new AbortController(),q=new AbortController();request=controller;quotaRequest=q;
          setNow(new Date());setBusy(true);setError(false);const clock=setTimeout(()=>controller.abort(),120000),qclock=setTimeout(()=>q.abort(),18000);
          void (async()=>{try{
            const url=new URL('tanuki-toolbox/home',document.baseURI);url.searchParams.set('days',dateRange().join(','));if(generation>0)url.searchParams.set('force','1');
            const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error('Unavailable');const value=await response.json();
            if(valid()&&request===controller){setData(value);setError(value.available!==true);}
          }catch{if(valid()&&request===controller)setError(true);}finally{clearTimeout(clock);if(valid()&&request===controller)setBusy(false);}})();
          void (async()=>{try{
            if(!codex){if(valid())setQuota({phase:'none'});return;}
            const rpc=codex.inject?.()?.rpc;if(typeof rpc?.call!=='function')throw new Error('Quota unavailable');
            if(valid())setQuota(previous=>({...previous,phase:'loading'}));
            const result=await rpc.call('/codex-subscription','usage',{force:false},q.signal);q.signal.throwIfAborted();if(!result?.ok)throw new Error('Quota unavailable');
            const windows=(result.value?.rateLimits||[]).flatMap(limit=>(limit.windows||[]).map(window=>({...window,name:limit.name||limit.id}))).filter(window=>Number.isFinite(window.remainingPercent)&&window.remainingPercent>=0&&window.remainingPercent<=100).slice(0,4);
            if(valid()&&quotaRequest===q)setQuota({phase:'ready',windows,plan:result.value?.planType});
          }catch{if(valid()&&quotaRequest===q)setQuota({phase:'error'});}finally{clearTimeout(qclock);}})();
        }
        const wake=()=>{if(!document.hidden&&Date.now()-last>45000)void load();};
        const visibility=()=>{if(document.hidden){last=0;request?.abort();quotaRequest?.abort();}else wake();};
        const nextDay=()=>{const next=new Date();next.setHours(24,0,0,100);midnight=setTimeout(()=>{void load();nextDay();},Math.max(1000,+next-Date.now()));};
        void load();nextDay();window.addEventListener('focus',wake);document.addEventListener('visibilitychange',visibility);
        return()=>{mounted=false;request?.abort();quotaRequest?.abort();clearTimeout(midnight);window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',visibility);};
      },[active,generation,codex]);
      const fmt=value=>Number.isFinite(value)?new Intl.NumberFormat(locale,{notation:value>=10000?'compact':'standard',maximumFractionDigits:1}).format(value):'—';
      const full=value=>new Intl.NumberFormat(locale).format(value),date=value=>new Intl.DateTimeFormat(locale,{month:'short',day:'numeric'}).format(new Date(value));
      const open=id=>{window.dispatchEvent(new Event('tanuki:clear-handoff'));ctx.get('uiWorkspace')?.openSession(id);};
      const navigate=key=>{window.dispatchEvent(new Event('tanuki:clear-handoff'));ctx.layout.selectPanel(key);};
      const can=key=>ctx.slots.entries('main').some(entry=>entry.options?.key===key);
      const rows=Object.values(sessions.byId||{}).filter(row=>row.origin!=='subagent');
      const allAttention=rows.filter(row=>statuses.get?.(row.id)?.pendingInteraction||statuses.get?.(row.id)?.running).sort((a,b)=>Number(!!statuses.get(b.id)?.pendingInteraction)-Number(!!statuses.get(a.id)?.pendingInteraction));const attention=allAttention.slice(0,5);
      const days=data?.days||[],yesterday=days[5],today=days[6],recent=data?.recent||[],max=Math.max(1,...days.map(day=>day.tasks));
      const title=id=>sessions.byId?.[id]?.title||recent.find(row=>row.id===id)?.title||t('untitled');
      const stat=(label,value,hint,icon,partial=data?.partial)=>h('section',{className:'tanuki-home-stat'},h('div',{className:'tanuki-home-stat-label'},h(Icon,{name:icon}),label),h('strong',{title:Number.isFinite(value)?full(value):undefined},partial&&Number.isFinite(value)?'≥ ':'',fmt(value)),h('small',null,hint));
      const heading=(name,aside)=>h('div',{className:'tanuki-home-card-heading'},h('h2',null,name),aside);
      const emptyText=text=>h('p',{className:'tanuki-home-empty'},text);
      const weekStart=new Date(now);weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7));
      const week=Array.from({length:7},(_,i)=>{const day=new Date(weekStart);day.setDate(day.getDate()+i);return day;});
      return h('main',{'data-tanuki-home':'','aria-label':t('homeTitle'),className:'tanuki-home'},h('div',{className:'tanuki-home-inner'},
        h('header',{className:'tanuki-home-heading'},h('div',null,h('span',{className:'tanuki-home-eyebrow'},'TANUKI TOOLBOX'),h('h1',null,t(now.getHours()<12?'morning':now.getHours()<18?'afternoon':'evening')),h('p',null,t('subtitle'))),h('button',{type:'button',className:'tanuki-home-refresh',disabled:busy,title:t('refresh'),'aria-label':t('refresh'),onClick:()=>setGeneration(n=>n+1)},h(Icon,{name:'refresh'}))),
        h('div',{className:'tanuki-home-top'},h('section',{className:'tanuki-home-calendar'},h('div',{className:'tanuki-home-date-main'},h('span',null,new Intl.DateTimeFormat(locale,{year:'numeric',month:'long'}).format(now)),h('strong',null,now.getDate()),h('span',null,new Intl.DateTimeFormat(locale,{weekday:'long'}).format(now))),h('div',{className:'tanuki-home-week'},h('span',{className:'tanuki-home-kicker'},t('thisWeek')),h('div',null,...week.map(day=>h('div',{key:+day,'data-today':day.toDateString()===now.toDateString()},h('small',null,new Intl.DateTimeFormat(locale,{weekday:'narrow'}).format(day)),h('span',null,day.getDate())))),h('small',{className:'tanuki-home-muted'},Intl.DateTimeFormat().resolvedOptions().timeZone))),
          h('section',{className:'tanuki-home-launch'},heading(t('quickStart')),h('p',{className:'tanuki-home-muted'},t('quickHint')),h('div',{className:'tanuki-home-shortcuts'},...[
            ['plus','newTask',()=>{navigate(null);ctx.get('uiWorkspace')?.startSession();},true],['clock','scheduled',()=>navigate('schedules'),can('schedules')],['plugins','pluginCenter',()=>navigate('plugins'),can('plugins')],['settings','toolbox',()=>settings('tanuki-toolbox'),true]
          ].map(([icon,label,action,enabled])=>h('button',{key:label,type:'button',disabled:!enabled,onClick:action},h(Icon,{name:icon}),h('span',null,t(label)),h(Icon,{name:'arrow'})))))),
        h('div',{className:'tanuki-home-stats','aria-busy':busy},stat(t('total'),data?.available?data.total:null,t('totalHint'),'chat'),stat(t('yesterdayTasks'),yesterday?.tasks,t('tasksHint'),'clock'),stat(t('yesterdayTokens'),yesterday?.tokens,t('tokensHint'),'tokens',data?.partial||yesterday?.usagePartial),stat(t('todayTasks'),today?.tasks,t('todayHint'),'bolt')),
        (busy||error||data?.partial||yesterday?.usagePartial)?h('p',{className:'tanuki-home-read-state',role:'status'},busy?t('loading'):error?t('unavailable'):data?.partial?t('partial'):t('usagePartial')):null,
        h('div',{className:'tanuki-home-columns'},
          h('section',{className:'tanuki-home-card'},heading(t('activity'),h('span',{className:'tanuki-home-muted'},t('sevenDays'))),h('div',{className:'tanuki-home-chart','aria-label':t('activity')},...(days.length?days:Array.from({length:7},(_,i)=>({start:dateRange()[i],tasks:null}))).map(day=>h('div',{key:day.start,className:'tanuki-home-chart-day'},h('span',{className:'tanuki-home-chart-value'},fmt(day.tasks)),h('div',{className:'tanuki-home-bar-track',title:date(day.start)+' · '+fmt(day.tasks)},h('div',{className:'tanuki-home-bar',style:{height:Math.max(day.tasks?5:0,(day.tasks||0)/max*100)+'%'}})),h('small',null,date(day.start))))),h('p',{className:'tanuki-home-muted'},t('activityHint'))),
          h('section',{className:'tanuki-home-card'},heading(t('myQuota'),h('span',{className:'tanuki-home-tag'},'Codex')),quota.phase==='loading'?emptyText(t('quotaLoading')):quota.phase==='none'?emptyText(t('noQuotaProvider')):quota.phase==='error'?emptyText(t('quotaError')):!quota.windows?.length?emptyText(t('quotaEmpty')):h('div',{className:'tanuki-home-quota-list'},...quota.windows.map((window,index)=>h('div',{key:index,className:'tanuki-home-quota'},h('div',null,h('span',null,window.name+' · '+t('hours',{n:fmt(window.windowSeconds/3600)})),h('strong',null,t('remaining',{n:fmt(window.remainingPercent)}))),h('div',{className:'tanuki-home-meter',role:'meter','aria-label':window.name,'aria-valuemin':0,'aria-valuemax':100,'aria-valuenow':window.remainingPercent},h('i',{style:{width:window.remainingPercent+'%'}})),h('small',{className:'tanuki-home-muted'},window.resetsAt?t('resets',{time:new Intl.DateTimeFormat(locale,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(window.resetsAt*1000))}):t('resetUnknown'))))),h('button',{type:'button',className:'tanuki-home-text-button',disabled:!codex,onClick:()=>settings('codex-subscription')},t('manageQuota'),h(Icon,{name:'arrow'}))),
          h('section',{className:'tanuki-home-card'},heading(t('recent'),h('span',{className:'tanuki-home-muted'},t('continue'))),recent.length?h('div',{className:'tanuki-home-session-list'},...recent.map(row=>h('button',{key:row.id,type:'button',onClick:()=>open(row.id)},h(Icon,{name:'chat'}),h('span',null,h('strong',null,title(row.id)),h('small',null,date(row.updatedAt))),h(Icon,{name:'arrow'})))):emptyText(busy?t('loading'):t('noRecent'))),
          h('section',{className:'tanuki-home-card'},heading(t('attention'),h('span',{className:'tanuki-home-tag'},allAttention.length)),attention.length?h('div',{className:'tanuki-home-session-list'},...attention.map(row=>h('button',{key:row.id,type:'button',onClick:()=>open(row.id)},h(Icon,{name:statuses.get(row.id)?.pendingInteraction?'clock':'bolt'}),h('span',null,h('strong',null,title(row.id)),h('small',null,t(statuses.get(row.id)?.pendingInteraction?'needsInput':'running'))),h(Icon,{name:'arrow'})))):h('div',{className:'tanuki-home-all-clear'},h(Icon,{name:'calendar'}),h('strong',null,t('allClear')),h('p',null,t('allClearHint'))))),
        h('footer',{className:'tanuki-home-footer'},h('span',null,t('scope')),data?.updatedAt?h('span',null,t('updated',{time:new Intl.DateTimeFormat(locale,{hour:'2-digit',minute:'2-digit'}).format(new Date(data.updatedAt))})):null)));
    }
    ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:HOME,locale:NS},Home));
    if(ctx.layout.panelInfo.getSnapshot().activePanelId==='tanuki-sidebar-home')ctx.layout.selectPanel(HOME);
    let brand=null,previous=null,frame;
    const open=event=>{event.preventDefault();event.stopImmediatePropagation();window.dispatchEvent(new Event('tanuki:clear-handoff'));ctx.layout.selectPanel(HOME);};
    const detach=()=>{if(!brand)return;brand.removeEventListener('click',open,true);for(const [name,value] of Object.entries(previous)){if(value===null)brand.removeAttribute(name);else brand.setAttribute(name,value);}brand=null;};
    const sync=()=>{
      const next=document.querySelector('[data-slot="sidebar"] button[class*="_brand"]');
      if(next!==brand){detach();if(!next)return;brand=next;previous=Object.fromEntries(['aria-label','aria-keyshortcuts','title'].map(key=>[key,brand.getAttribute(key)]));brand.addEventListener('click',open,true);}
      if(brand.getAttribute('aria-label')!==t('homeBack'))brand.setAttribute('aria-label',t('homeBack'));
      if(brand.getAttribute('title')!==t('homeBack'))brand.setAttribute('title',t('homeBack'));
      brand.removeAttribute('aria-keyshortcuts');
    };
    const queue=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(sync);};
    const observer=new MutationObserver(queue);observer.observe(document.body,{childList:true,subtree:true});sync();
    const offLocale=ctx.locale.subscribe(sync);
    if(!window.__tanukiHomeInitialized){window.__tanukiHomeInitialized=true;if(!window.__tanukiViewHandoffV1&&ctx.layout.panelInfo.getSnapshot().activePanelId===null)ctx.layout.selectPanel(HOME);}
    ctx.effect(()=>()=>{observer.disconnect();cancelAnimationFrame(frame);offLocale();detach();if(lifecycle.disabled&&ctx.layout.panelInfo.getSnapshot().activePanelId===HOME)ctx.layout.selectPanel(null);});
  }
  return {name:'tanuki-home-runtime',inject:['slots','locale','layout','sessions','uiWorkspace','uiSession'],apply};
});
