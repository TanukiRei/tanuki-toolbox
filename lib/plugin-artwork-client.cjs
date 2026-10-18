'use strict';
function createPluginArtwork({document}){
  const entries=new Map();let disposed=false;
  const marker='data-tanuki-plugin-artwork',ready='data-tanuki-artwork-ready';
  function initials(name){
    const label=name.replace(/^@[^/]+\//,'').replace(/^dsh[-_]/i,'').replace(/([a-z])([A-Z])/g,'$1 $2');
    const words=label.split(/[-_\s]+/).filter(Boolean);
    return (words.length>1?words[0][0]+words[1][0]:label.slice(0,2)).toUpperCase()||'?';
  }
  function remove(entry){entry.disposed=true;entry.image.onload=null;entry.image.onerror=null;entry.image.removeAttribute('src');entry.host.remove();entry.slot.removeAttribute(ready);}
  function sync(page,bundles,icons){
    if(disposed)return;
    const packages=new Map(bundles.filter(p=>p.installed&&p.official!==true&&!(p.official===undefined&&p.optional===true)).map(p=>[p.name,p]));
    const targets=new Map();
    for(const owner of page.querySelectorAll('[data-plugin-group="bundles"] [data-plugin-package], [data-plugin-detail]')){
      const name=owner.getAttribute('data-plugin-package')||owner.getAttribute('data-plugin-detail'),pkg=packages.get(name);
      if(!pkg)continue;
      const slot=owner.querySelector(owner.hasAttribute('data-plugin-detail')?':scope > [data-window-drag] > div:last-child > span:first-child':':scope > div:first-child > span:first-child');
      if(!slot)continue;
      // Preserve a host-provided image, including future author icon declarations.
      const native=slot.querySelector(':scope > img');
      if(native&&(!native.complete||native.naturalWidth>0))continue;
      const art=icons[name],usable=art&&art.version===pkg.version&&typeof art.src==='string'&&/^data:image\/(?:svg\+xml|png|webp|jpeg|gif|x-icon);base64,[a-z\d+/=]+$/i.test(art.src);
      targets.set(slot,{name,src:usable?art.src:'',mask:usable&&art.mask===true});
    }
    for(const [slot,entry] of entries){
      const next=targets.get(slot);
      if(!next||next.name!==entry.name||next.src!==entry.src||next.mask!==entry.mask||entry.host.parentElement!==slot){remove(entry);entries.delete(slot);}
    }
    for(const [slot,target] of targets){
      if(entries.has(slot))continue;
      const host=document.createElement('span'),label=document.createElement('span'),image=document.createElement('img');
      host.setAttribute(marker,'');host.setAttribute('aria-hidden','true');host.className='tanuki-plugin-artwork';
      label.className='tanuki-plugin-initials';label.textContent=initials(target.name);
      image.alt='';image.draggable=false;image.hidden=true;host.append(label,image);
      const entry={...target,slot,host,image,disposed:false};entries.set(slot,entry);
      image.onload=()=>{
        if(disposed||entry.disposed||!host.isConnected)return;
        label.hidden=true;
        if(target.mask){host.classList.add('tanuki-plugin-artwork-mask');host.style.setProperty('--tanuki-plugin-mask','url("'+target.src+'")');}
        else image.hidden=false;
      };
      image.onerror=()=>{if(!disposed&&!entry.disposed){label.hidden=false;image.hidden=true;}};
      slot.appendChild(host);slot.setAttribute(ready,'');
      if(target.src)image.src=target.src;
    }
  }
  return {sync,dispose(){disposed=true;for(const entry of entries.values())remove(entry);entries.clear();}};
}
module.exports={createPluginArtwork};
