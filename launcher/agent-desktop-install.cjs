'use strict';
// Exact-version adapter only. Never changes EXE/fuses, offsets, unrelated members,
// launches the UI, or patches a running desktop. Keeps an original backup.
// Electron's patched fs treats app.asar as a virtual directory. Raw archive
// inspection/replacement must use original-fs, without changing process.noAsar
// (which would affect the running host's unrelated imports).
const fs=(()=>{try{return require('original-fs');}catch{return require('node:fs');}})(),path=require('node:path'),crypto=require('node:crypto');
const marker='// tanuki-agent-interface-v1';
const knownMain='6f3d1ddd1106371452c2204be6dfb2e5460a8e8259cdd05cdccb5387b3f9a85a';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const sameArchive=(a,b)=>typeof a==='string'&&typeof b==='string'&&fs.realpathSync(a).toLowerCase()===fs.realpathSync(b).toLowerCase();
function atomic(file,bytes){const tmp=file+'.'+crypto.randomUUID()+'.tmp';try{fs.writeFileSync(tmp,bytes,{flag:'wx',mode:0o600});fs.renameSync(tmp,file);}finally{try{fs.unlinkSync(tmp);}catch{}}}
function inspect(executable){
  const archive=path.join(path.dirname(executable),'resources','app.asar'),fd=fs.openSync(archive,'r');
  try{const prefix=Buffer.alloc(16);fs.readSync(fd,prefix,0,16,0);if(prefix.readUInt32LE(0)!==4||prefix.readUInt32LE(12)>16*1024*1024)throw Error('UNSUPPORTED_ASAR');const json=Buffer.alloc(prefix.readUInt32LE(12));fs.readSync(fd,json,0,json.length,16);const header=JSON.parse(json),node=header.files.lib.files['main.js'],base=8+prefix.readUInt32LE(4);if(node.unpacked||node.size>2*1024*1024)throw Error('UNSUPPORTED_MAIN');const bytes=Buffer.alloc(node.size);fs.readSync(fd,bytes,0,bytes.length,base+Number(node.offset));return {archive,header,node,base,headerText:json.toString('utf8'),main:bytes,installed:bytes.includes(Buffer.from(marker)),compatible:hash(bytes)===knownMain};}finally{fs.closeSync(fd);}
}
async function prepare(plan,planFile){
  const dir=path.join(plan.profile,'.tanuki-toolbox','agent-interface'),status=path.join(dir,'desktop-setup.json');
  const state=require(path.join(plan.profile,'node_modules/dsh-local-plugin-center/lib/component-state.cjs'));
  if(await state.enabled({dir:plan.profile,installAnchor:plan.installAnchor},'tanuki-agent-interface')!==true){atomic(status,JSON.stringify({state:'cancelled'}));return;}
  if(path.resolve(plan.executable).toLowerCase()!==path.resolve(process.execPath).toLowerCase())throw Error('INSTALL_MISMATCH');
  const exe=fs.readFileSync(plan.executable),sentinel=Buffer.from('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX'),position=exe.indexOf(sentinel);
  if(position<0||exe[position+sentinel.length]!==1||exe[position+sentinel.length+1]<5||exe[position+sentinel.length+2+4]!==48)throw Error('INTEGRITY_ENFORCED_OR_UNKNOWN');
  const info=inspect(plan.executable),input=fs.readFileSync(info.archive),originalHash=hash(input),resources=path.dirname(info.archive),target=path.join(resources,'tanuki-agent-control.mjs'),manifestFile=path.join(dir,'desktop-adapter.json');
  const bridge=fs.readFileSync(path.join(__dirname,'agent-desktop-main.mjs'));
  if(hash(bridge)!==plan.bridgeSha256)throw Error('BRIDGE_INTEGRITY_FAILED');
  if(info.installed){
    const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));if(manifest.patchedMainSha256!==hash(info.main)||!sameArchive(manifest.archive,info.archive))throw Error('EXISTING_ADAPTER_CHANGED');
    manifest.bridgeSha256=hash(bridge);atomic(path.join(path.dirname(planFile),'commit.json'),JSON.stringify({schema:1,profile:plan.profile,executable:plan.executable,archive:info.archive,expectedSha256:originalHash,replaceArchive:false,bridgeSha256:hash(bridge),manifest}));return;
  }
  const {output,bytes}=patch(input,info,path.dirname(planFile));
  if(fs.existsSync(target))throw Error('ADAPTER_TARGET_EXISTS');
  const backups=path.join(dir,'backups',crypto.randomUUID());fs.mkdirSync(backups,{recursive:true,mode:0o700});const backup=path.join(backups,'app.asar');fs.copyFileSync(info.archive,backup,fs.constants.COPYFILE_EXCL);if(hash(fs.readFileSync(backup))!==originalHash)throw Error('BACKUP_INTEGRITY_FAILED');
  if(await state.enabled({dir:plan.profile,installAnchor:plan.installAnchor},'tanuki-agent-interface')!==true)throw Error('INTERFACE_DISABLED');
  const snapshot=path.dirname(planFile);atomic(path.join(snapshot,'app.asar.pending'),output);
  const manifest={archive:info.archive,version:'0.2.1-rc.2',backup,originalSha256:originalHash,patchedSha256:hash(output),patchedMainSha256:hash(bytes),bridgeSha256:hash(bridge),fixedMemberOffsets:true};
  // Electron opens its archive even in Node mode. Only stage bytes here; the
  // native worker waits for this process to exit before replacing app.asar.
  atomic(path.join(snapshot,'commit.json'),JSON.stringify({schema:1,profile:plan.profile,executable:plan.executable,archive:info.archive,expectedSha256:originalHash,replaceArchive:true,bridgeSha256:hash(bridge),manifest}));
}
// Pure build step: generate a fixed-offset archive in memory and parse its main.
// Exported so developers can perform this compilation without installing it.
function patch(input,info,stagingDirectory=__dirname){
  if(!info.compatible)throw Error('DESKTOP_VERSION_UNSUPPORTED');
  const source=info.main.toString('utf8'),anchor='\tmainWindow = createMainWindow();\n\tif (typeof manifest',urlImport='import { fileURLToPath } from "node:url";';
  const constructor='\tconstructor(node, runtimeDir, projectDir, inspectPort, environment = process.env, onFailure, primaryRuntime, packageManager, onPlatformSession) {';
  const at=source.indexOf(constructor),docStart=source.lastIndexOf('\t/**',at),doc=source.slice(docStart,at);
  if(at<0||docStart<0||!/^\t\/\*\*[\s\S]*?\*\/\s*$/.test(doc)||!doc.includes('@param runtimeDir')||doc.includes('*/\n\t/**')||source.split(anchor).length!==2||source.split(urlImport).length!==2)throw Error('DESKTOP_LAYOUT_CHANGED');
  const second='\tapplication.on("second-instance", focusOwner);';
  const replacement='\tif(process.argv.some(a=>a.startsWith("--tanuki-agent-control="))){application.quit();return false;}\n\tapplication.on("second-instance",(...args)=>{if(args[1]?.some(a=>a.startsWith("--tanuki-agent-control="))){tanukiAgentControl?.(args[1]);return;}focusOwner(...args);});';
  const hook='\t'+marker+'\n\ttanukiAgentControl=argv=>{void import(pathToFileURL(join(process.resourcesPath,"tanuki-agent-control.mjs")).href).then(m=>m.handleDesktopControl({executable:process.execPath,profile:paths.profile,installAnchor:join(resources.dsh,"package.json"),version:app.getVersion(),available:()=>!quitting&&!shellInstallerOwnsQuit&&!recovery.active&&backendReady&&updateState.phase!=="installing",inspect:()=>backend.host?.inspectQuit(),admission:action=>backend.host?.updateTasks(action),quit:()=>quitWithoutConfirmation(),relaunch:file=>app.once("will-quit",()=>app.relaunch({execPath:file,args:[]}))},argv)).catch(()=>{});};\n';
  if(source.split(second).length!==2)throw Error('SINGLE_INSTANCE_API_CHANGED');
  let modified=source.slice(0,docStart)+source.slice(at);
  const claim=modified.indexOf('function claimDesktopSingleInstance(application, focusOwner) {'),claimDocStart=modified.lastIndexOf('/**',claim),claimDoc=modified.slice(claimDocStart,claim);
  if(!/^\/\*\*[\s\S]*?\*\/\s*$/.test(claimDoc)||!claimDoc.includes('Claim the process-lifetime Desktop lock')||claimDoc.includes('*/\n/**'))throw Error('SINGLE_INSTANCE_DOCUMENTATION_CHANGED');
  modified=(modified.slice(0,claimDocStart)+modified.slice(claim)).replace('function claimDesktopSingleInstance(application, focusOwner) {','let tanukiAgentControl;\nfunction claimDesktopSingleInstance(application, focusOwner) {').replace(second,replacement).replace(anchor,hook+anchor).replace(urlImport,'import { fileURLToPath, pathToFileURL } from "node:url";');
  const size=Buffer.byteLength(modified);if(size>info.main.length)throw Error('PATCH_EXCEEDS_FIXED_SLOT');const bytes=Buffer.concat([Buffer.from(modified),Buffer.alloc(info.main.length-size,32)]);
  // Parse only, in a child Node invocation; never execute the staged main module.
  const staged=path.join(stagingDirectory,'main-staged.mjs');fs.writeFileSync(staged,bytes);
  const checked=require('node:child_process').spawnSync(process.execPath,['--check',staged],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},windowsHide:true,stdio:'ignore'});if(checked.status!==0)throw Error('PATCH_PARSE_FAILED');
  const updated=structuredClone(info.node);
  if(updated.integrity){if(updated.integrity.algorithm!=='SHA256'||!Number.isSafeInteger(updated.integrity.blockSize)||updated.integrity.blockSize<=0)throw Error('UNSUPPORTED_INTEGRITY');updated.integrity.hash=hash(bytes);updated.integrity.blocks=[];for(let i=0;i<bytes.length;i+=updated.integrity.blockSize)updated.integrity.blocks.push(hash(bytes.subarray(i,i+updated.integrity.blockSize)));}
  const before='"main.js":'+JSON.stringify(info.node),after='"main.js":'+JSON.stringify(updated);if(info.headerText.split(before).length!==2||before.length!==after.length)throw Error('HEADER_LAYOUT_CHANGED');
  const head=Buffer.from(info.headerText.replace(before,after));if(head.length!==Buffer.byteLength(info.headerText))throw Error('HEADER_SIZE_CHANGED');
  const start=info.base+Number(info.node.offset),end=start+info.node.size,output=Buffer.from(input);head.copy(output,16);bytes.copy(output,start);
  if(output.length!==input.length||!output.subarray(info.base,start).equals(input.subarray(info.base,start))||!output.subarray(end).equals(input.subarray(end)))throw Error('UNRELATED_BYTES_CHANGED');
  return {output,bytes};
}
if(require.main===module){let plan;try{plan=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));}catch{process.exitCode=1;}
  if(plan)prepare(plan,process.argv[2]).catch(error=>{try{atomic(path.join(plan.profile,'.tanuki-toolbox/agent-interface/desktop-setup.json'),JSON.stringify({state:'error',code:/^[A-Z_]+$/.test(error.message)?error.message:'SETUP_UNAVAILABLE',systemCode:error.code||null}));}catch{}process.exitCode=1;});
}
module.exports={inspect,hash,atomic,patch,prepare,sameArchive};
