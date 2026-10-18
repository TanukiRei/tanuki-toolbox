document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),h=React.createElement,NS='tanukiHome';
  function apply(ctx,{lifecycle}){
    const HOME='tanuki-home';
    ctx.effect(()=>ctx.locale.register(NS,{"zh":{"homeTitle":"起始页","homeBack":"返回起始页"},"en":{"homeTitle":"Home","homeBack":"Back to Home"}}));const t=ctx.locale.bind(NS);
    function Home(){React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());return h('main',{'data-tanuki-home':'','aria-label':t('homeTitle'),style:{height:'100%',width:'100%',background:'var(--dsw-alias-bg-base,#151515)'}});}
    ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:HOME,locale:NS},Home));
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
  return {name:'tanuki-home-runtime',inject:['slots','locale','layout'],apply};
});
