'use strict';
// Self-contained factory: build inlines this exact function in settings and island chunks.
function createAudioPreview({baseURI} = {}) {
  let context=null,disposed=false,epoch=0,request=null,timer=null,cachedRevision=null,cachedBuffer=null;
  const nodes=new Set();
  function stop(){++epoch;request?.abort();request=null;clearTimeout(timer);timer=null;for(const node of nodes){try{node.stop?.();node.disconnect();}catch{}}nodes.clear();}
  function getContext(){if(disposed)throw new Error('Audio preview closed');if(!context){const Constructor=window.AudioContext||window.webkitAudioContext;if(!Constructor)throw new Error('Audio unavailable');context=new Constructor();}return context;}
  async function unlock(){const sound=getContext();if(sound.state==='suspended')await sound.resume();return sound;}
  async function play({volume=100,audio=null,soundEnabled=true}={}, {gesture=true}={}){
    stop();const generation=epoch;
    const level=Math.max(0,Math.min(100,Number.isFinite(Number(volume))?Number(volume):100))/100;
    if(disposed||!soundEnabled||level===0)return false;
    // Resume synchronously within the caller's user gesture, before any fetch/decode.
    const sound=getContext();if(gesture&&sound.state==='suspended')await sound.resume();
    if(disposed||generation!==epoch)return false;
    if(sound.state!=='running')return false; // Never replay autoplay-blocked notifications later.
    let buffer=null;
    try{
      if(audio?.revision){
        if(cachedRevision===audio.revision)buffer=cachedBuffer;
        else{
          const controller=new AbortController();request=controller;timer=setTimeout(()=>controller.abort(),15000);
          const response=await fetch(new URL('tanuki-toolbox/settings/audio',baseURI||document.baseURI),{credentials:'same-origin',cache:'no-store',signal:controller.signal});
          if(!response.ok)throw new Error('Audio unavailable');
          const bytes=await response.arrayBuffer();if(bytes.byteLength>5*1024*1024)throw new Error('Audio too large');
          if(disposed||generation!==epoch)return false;
          buffer=await sound.decodeAudioData(bytes);
          if(disposed||generation!==epoch)return false;
          cachedRevision=audio.revision;cachedBuffer=buffer;
        }
      }else{cachedRevision=null;cachedBuffer=null;}
      if(disposed||generation!==epoch)return false;
      const master=sound.createGain(),limiter=sound.createDynamicsCompressor();
      master.gain.value=level;limiter.threshold.value=-6;limiter.knee.value=6;limiter.ratio.value=12;limiter.attack.value=0.003;limiter.release.value=0.15;
      master.connect(limiter);limiter.connect(sound.destination);nodes.add(master);nodes.add(limiter);
      const cleanup=()=>{for(const node of [master,limiter]){node.disconnect();nodes.delete(node);}};
      const start=sound.currentTime+0.005;
      if(buffer){
        const source=sound.createBufferSource(),envelope=sound.createGain();source.buffer=buffer;
        const duration=Math.min(buffer.duration,30);if(duration<=0){cleanup();return false;}
        envelope.gain.setValueAtTime(0,start);envelope.gain.linearRampToValueAtTime(1,start+Math.min(0.012,duration/3));envelope.gain.setValueAtTime(1,start+Math.max(duration-0.03,duration/3));envelope.gain.linearRampToValueAtTime(0,start+duration);
        source.connect(envelope);envelope.connect(master);nodes.add(source);nodes.add(envelope);
        source.onended=()=>{source.disconnect();envelope.disconnect();nodes.delete(source);nodes.delete(envelope);cleanup();};source.start(start);source.stop(start+duration);
      }else{
        let pending=2;
        for(const [offset,frequency,peak] of [[0,660,0.16],[0.09,880,0.14]]){
          const oscillator=sound.createOscillator(),gain=sound.createGain(),at=start+offset;
          oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency,at);
          gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(peak,at+0.018);gain.gain.exponentialRampToValueAtTime(0.0001,at+0.30);gain.gain.linearRampToValueAtTime(0,at+0.32);
          oscillator.connect(gain);gain.connect(master);nodes.add(oscillator);nodes.add(gain);
          oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();nodes.delete(oscillator);nodes.delete(gain);if(--pending===0)cleanup();};oscillator.start(at);oscillator.stop(at+0.33);
        }
      }
      return true;
    }catch(error){if(disposed||generation!==epoch||error?.name==='AbortError')return false;throw error;}
    finally{if(generation===epoch){clearTimeout(timer);timer=null;request=null;}}
  }
  function dispose(){if(disposed)return;disposed=true;stop();cachedBuffer=null;cachedRevision=null;const old=context;context=null;if(old)void old.close().catch(()=>{});}
  return {play,stop,dispose,unlock};
}
module.exports={createAudioPreview};
