// Kept dependency-free so the same update state machine runs in the browser and tests.
function createMarketUpdater({request, capabilities, inventory, available, changed, completed, storage, wait:customWait, now=Date.now}) {
  const schema='dsh-market/update-api/v1', key='tanuki-toolbox:update-v1', batchKey='tanuki-toolbox:update-all-v1';
  let state={busy:false,phase:'idle',batchBusy:false}, disposed=false, batch=null, batchFlight=null;
  const waits=new Map();
  const wait=ms=>disposed?Promise.resolve():customWait?customWait(ms):new Promise(resolve=>{const timer=setTimeout(()=>{waits.delete(timer);resolve();},ms);waits.set(timer,resolve);});
  const publish=patch=>{state={...state,...patch};if(!disposed)changed(state);};
  const save=record=>{try{record?storage?.setItem(key,JSON.stringify(record)):storage?.removeItem(key);}catch{}};
  const read=()=>{try{const x=JSON.parse(storage?.getItem(key)||'null');return x&&typeof x.name==='string'&&typeof x.operationId==='string'?x:null;}catch{return null;}};
  const saveBatch=()=>{try{batch?storage?.setItem(batchKey,JSON.stringify(batch)):storage?.removeItem(batchKey);}catch{}};
  const readBatch=()=>{try{const x=JSON.parse(storage?.getItem(batchKey)||'null');return x&&Array.isArray(x.names)&&x.names.length>0&&x.names.length<=1024&&x.names.every(n=>typeof n==='string'&&n.length<=250)&&Number.isSafeInteger(x.total)?x:null;}catch{return null;}};
  const eligible=name=>{const pkg=inventory().find(p=>p.name===name);return pkg?.installed&&pkg.removable!==false&&pkg.official!==true&&pkg.optional!==true&&pkg.readOnlyReason===undefined&&available().some(p=>p.name===name);};
  const supported=c=>c?.schema===schema&&c.features?.update===true&&c.features?.progress===true&&typeof c.endpoints?.updates==='string'&&typeof c.endpoints?.operations==='string';
  const check=(body,name,id)=>{
    const op=body?.operation;
    if(body?.schema!==schema||!op||op.packageName!==name||typeof op.operationId!=='string'||(id&&op.operationId!==id)||!['queued','running','succeeded','failed','cancelled','rolled-back'].includes(op.state))throw Object.assign(new Error('Invalid operation'),{code:'INVALID_RESPONSE'});
    return op;
  };
  async function observe(caps,record,initial){
    const deadline=now()+15*60*1000;let op=initial,errors=0;
    while(!disposed&&now()<deadline){
      if(!op){
        try{
          const url=new URL(caps.endpoints.operations,'https://same-origin.invalid');url.searchParams.set('operationId',record.operationId);
          // Keep the discovered origin intact; request() enforces same-origin.
          const endpoint=/^https?:/.test(caps.endpoints.operations)?new URL(caps.endpoints.operations):null;
          if(endpoint){endpoint.searchParams.set('operationId',record.operationId);}
          op=check(await request(endpoint?endpoint.href:url.pathname+url.search),record.name,record.operationId);errors=0;
        }catch(error){if(disposed)return;if(++errors>=3||error.status===404)throw error;await wait(1500);continue;}
      }
      if(disposed)return;
      publish({percent:Number.isFinite(op.progress?.percent)?Math.max(0,Math.min(100,Math.round(op.progress.percent))):null});
      if(['succeeded','failed','cancelled','rolled-back'].includes(op.state)){
        save(null);
        const verified=op.state==='succeeded'&&typeof op.installedVersion==='string'&&op.installedVersion!==op.beforeVersion;
        // Commit the queue before host refresh/HMR can dispose this instance.
        if(batch?.names[0]===record.name){if(verified){batch.names.shift();batch.current=null;}else batch=null;saveBatch();}
        publish({busy:false,phase:verified?'succeeded':'failed',code:verified?null:op.failure?.code|| (op.state==='succeeded'?'VERSION_UNCHANGED':op.state.toUpperCase()),restartRequired:verified&&op.outcome?.restartRequired===true,refreshRequired:verified&&op.outcome?.refreshRequired===true,installedVersion:op.installedVersion});
        await completed(state);return;
      }
      await wait(1200);op=null;
    }
    if(!disposed)throw Object.assign(new Error('Observation timed out'),{code:'STATUS_UNKNOWN'});
  }
  async function run(name,resume){
    if(disposed||state.busy)return false;
    const caps=capabilities(),pkg=inventory().find(p=>p.name===name);
    if(!supported(caps)||!pkg?.installed||pkg.removable===false||pkg.readOnlyReason!==undefined||(!resume&&!available().some(p=>p.name===name)))return false;
    // Never issue a second POST while a previously accepted operation is unresolved.
    if(!resume&&read()){publish({phase:'unknown',code:'STATUS_UNKNOWN',name:read().name});return false;}
    publish({busy:true,phase:'running',name,percent:null,code:null,operationId:resume?.operationId||null,restartRequired:false});
    let record=resume;
    try{
      let initial;
      if(!record){
        initial=check(await request(caps.endpoints.updates,{method:'POST',body:{packageName:name}}),name);
        record={name,operationId:initial.operationId};save(record);publish({operationId:record.operationId});
      }
      await observe(caps,record,initial);
    }catch(error){
      if(!disposed){
        // A replacement Host cannot retain the former process's operation ID.
        if(record&&error.status===404)save(null);
        const uncertain=!!record||!error.status||error.status>=500;
        publish({busy:false,phase:uncertain?'unknown':'failed',code:uncertain?'STATUS_UNKNOWN':error.code||'UPDATE_FAILED'});
      }
    }
    return true;
  }
  async function drain(){
    publish({batchBusy:true,batchTotal:batch.total});
    try{
      while(!disposed&&batch?.names.length){
        const name=batch.names[0],record=read();
        publish({batchIndex:batch.total-batch.names.length+1});
        if(record&&record.name!==name){publish({phase:'unknown',name:record.name,code:'STATUS_UNKNOWN'});break;}
        if(!record&&batch.current?.name===name){
          // A request may have reached the host without its acknowledgement
          // reaching us. Never replay that POST after reload.
          const version=inventory().find(p=>p.name===name)?.version;
          if(version&&typeof batch.current.beforeVersion==='string'&&version!==batch.current.beforeVersion){batch.names.shift();batch.current=null;saveBatch();continue;}
          publish({phase:'unknown',name,code:'STATUS_UNKNOWN'});break;
        }
        if(!record&&!eligible(name)){batch.names.shift();saveBatch();continue;}
        if(!supported(capabilities()))break;
        if(!record){batch.current={name,beforeVersion:inventory().find(p=>p.name===name)?.version};saveBatch();}
        const ran=await run(name,record);
        if(disposed)return;
        if(!ran||state.phase!=='succeeded')break;
      }
    }finally{
      if(!disposed){batch=null;saveBatch();publish({batchBusy:false});}
    }
  }
  function runBatch(){if(batchFlight)return batchFlight;batchFlight=drain().finally(()=>{batchFlight=null;});return batchFlight;}
  return {
    start:name=>state.batchBusy?Promise.resolve(false):run(name,null),
    startAll(names){
      if(disposed||state.busy||state.batchBusy||read()||!supported(capabilities()))return Promise.resolve(false);
      const selected=[...new Set(names)].filter(eligible);
      // Update providers last, so earlier operations retain their connection.
      const rank=name=>name==='dshmarket'?2:name==='dsh-local-plugin-center'?1:0;
      selected.sort((a,b)=>rank(a)-rank(b));if(!selected.length)return Promise.resolve(false);
      batch={names:selected,total:selected.length,current:null};saveBatch();return runBatch();
    },
    resume(){
      if(disposed||state.busy||state.batchBusy)return Promise.resolve(false);
      batch=readBatch();if(batch)return runBatch();
      const record=read();return record?run(record.name,record):Promise.resolve(false);
    },
    getState:()=>state,supported,
    dispose({discardBatch=false}={}){disposed=true;if(discardBatch){batch=null;saveBatch();}for(const [timer,resolve] of waits){clearTimeout(timer);resolve();}waits.clear();}
  };
}
module.exports={createMarketUpdater};
