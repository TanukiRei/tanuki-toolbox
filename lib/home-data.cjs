'use strict';
function register(ctx){
  let stopped=false,cache=null;
  ctx.effect(()=>()=>{stopped=true;cache=null;});
  require('./read-routes.cjs').register(ctx,{home:async(signal,request)=>{
    signal.throwIfAborted();if(stopped)throw new Error('Stopped');
    const raw=new URL(request.url,'http://localhost').searchParams.get('days')||'';
    const days=raw.split(',').map(Number);
    if(days.length!==8||days.some(n=>!Number.isSafeInteger(n))||days.some((n,i)=>i&&n-days[i-1]<20*3600000||i&&n-days[i-1]>28*3600000)||Math.abs(days[6]-Date.now())>2*86400000)throw new Error('Invalid date range');
    if(new URL(request.url,'http://localhost').searchParams.get('force')!=='1'&&cache?.key===raw&&Date.now()-cache.at<45000)return cache.value;
    const query=ctx.get('sessionQuery');if(typeof query?.listSessions!=='function'||typeof query?.observeSession!=='function')return {available:false};
    const records=await query.listSessions(signal);signal.throwIfAborted();
    const buckets=days.slice(0,7).map(start=>({start,tokens:0,usageRecords:0,usagePartial:false,tasks:new Set(),completed:0}));
    let total=0,errors=0,next=0;const recent=[];
    const positive=n=>Number.isSafeInteger(n)&&n>=0;
    const reportedTokens=data=>{
      const stream=Array.isArray(data?.stream)?data.stream:[];let sample=data?.usage;
      if(!sample)for(let i=stream.length-1;i>=0;i--)if(stream[i].type==='chunk'&&stream[i].chunk?.type==='usage'){sample=stream[i].chunk.usage;break;}
      if(!sample||!positive(sample.inputTokens)||!positive(sample.outputTokens))return null;
      if(['cacheReadTokens','cacheWriteTokens'].some(key=>sample[key]!==undefined&&!positive(sample[key])))return null;
      const known=sample.inputTokens+sample.outputTokens+(sample.cacheReadTokens||0)+(sample.cacheWriteTokens||0);
      if(!positive(known))return null;
      if(sample.totalTokens!==undefined)return positive(sample.totalTokens)&&sample.totalTokens>=known&&(sample.cacheReadTokens===undefined||sample.cacheWriteTokens===undefined||sample.totalTokens===known)?sample.totalTokens:null;
      return sample.cacheReadTokens!==undefined&&sample.cacheWriteTokens!==undefined?known:null;
    };
    const bucket=time=>{const n=typeof time==='number'?time:Date.parse(time);return buckets.findIndex((item,i)=>n>=item.start&&n<days[i+1]);};
    const worker=async()=>{
      while(next<records.length){
        signal.throwIfAborted();if(stopped)throw new Error('Stopped');const record=records[next++];let lease;
        try{
          lease=await query.observeSession(record.header.id,{signal,projectionMode:'none'});signal.throwIfAborted();
          const root=!(lease.header.delegationDepth>0),events=lease.events,inherited=lease.inheritedEventCount||0;
          let title='',updatedAt=lease.header.createdAt,used=false;
          for(let i=0;i<events.length;i++){
            if(i%500===0){signal.throwIfAborted();await new Promise(resolve=>setImmediate(resolve));if(stopped)throw new Error('Stopped');}
            const event=events[i];if(event.type==='session/title'&&typeof event.data?.title==='string')title=event.data.title.slice(0,160);
            if(i<inherited)continue;
            const time=typeof event.time==='number'?event.time:Date.parse(event.time);if(Number.isFinite(time))updatedAt=Math.max(Number(updatedAt)||0,time);
            if(event.type==='user/message'||event.type==='turn/start')used=true;
            const index=bucket(event.time);if(index<0)continue;const day=buckets[index];
            if(root&&event.type==='turn/start')day.tasks.add(record.header.id);
            if(root&&event.type==='turn/end'&&event.data?.reason?.kind==='completed')day.completed++;
            if(event.type==='assistant/message'||event.type==='assistant/attempt'){
              const tokens=reportedTokens(event.data);
              if(tokens!==null&&positive(day.tokens+tokens)){day.tokens+=tokens;day.usageRecords++;}else day.usagePartial=true;
            }
          }
          if(root&&used){total++;recent.push({id:record.header.id,title,updatedAt:Number(updatedAt)||0});recent.sort((a,b)=>b.updatedAt-a.updatedAt);if(recent.length>6)recent.length=6;}
        }catch(error){if(signal.aborted||stopped)throw error;errors++;}
        finally{lease?.[Symbol.dispose]?.();}
      }
    };
    await Promise.all(Array.from({length:Math.min(2,records.length)},worker));signal.throwIfAborted();
    const value={available:true,total,partial:errors>0,errors,scanned:records.length-errors,records:records.length,updatedAt:Date.now(),recent,days:buckets.map(day=>({...day,tasks:day.tasks.size,tokens:day.usageRecords||!day.tasks.size&&!day.usagePartial?day.tokens:null}))};
    if(!stopped)cache={key:raw,at:Date.now(),value};return value;
  }});
}
module.exports={register};
