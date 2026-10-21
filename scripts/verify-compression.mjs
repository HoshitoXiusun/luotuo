// Browser regression for an anonymous 5–10 second moving video with audible tone.
// Invoked via ego-browser with an existing TaskSpace; never publishes fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export async function verifyCompression(task,{htmlPath,videoPath,outputDir}){
 const p=task.page('p1'),results={};await fs.mkdir(outputDir,{recursive:true});
 await p.cdp('Emulation.setFocusEmulationEnabled',{enabled:true});await p.cdp('Emulation.clearDeviceMetricsOverride',{});
 try{
  await p.goto(pathToFileURL(htmlPath).href);await p.click('[data-mode="compress"]');
  await p.evaluate(()=>{window.compressionErrors=[];for(const name of ['error','unhandledrejection','securitypolicyviolation'])addEventListener(name,e=>compressionErrors.push(name+':'+(e.message||e.reason?.message||e.violatedDirective)))});
  await p.setInputFiles('#compressInput',[videoPath]);await p.waitForFunction(()=>!document.getElementById('compressStart').disabled);
  const source=await p.evaluate(()=>({...compression.info}));assert(source.duration>=5&&source.duration<=10,'Use an anonymous short fixture');
  await p.selectOption('#compressResolution','480');await p.selectOption('#compressQuality','small');await p.click('.compression-more summary');
  const measure=async audio=>await p.evaluate(async audio=>{
   if(!compression.result)throw Error(document.getElementById('compressStatus').textContent);
   const v=document.getElementById('compressResultVideo');if(v.readyState===0)await new Promise((q,j)=>{v.addEventListener('loadedmetadata',q,{once:true});setTimeout(()=>j(Error('Result metadata timed out')),5000)});
   v.currentTime=v.duration/2;await new Promise((q,j)=>{v.addEventListener('seeked',q,{once:true});setTimeout(()=>j(Error('Result seek timed out')),5000)});
   const result={bytes:compression.result.blob.size,mime:compression.result.blob.type,duration:v.duration,width:v.videoWidth,height:v.videoHeight,seek:v.currentTime,sourceDuration:compression.info.duration};
   const a=new AudioContext();try{const b=await a.decodeAudioData(await compression.result.blob.arrayBuffer()),d=b.getChannelData(0);result.rms=Math.sqrt(d.reduce((n,x)=>n+x*x,0)/d.length);result.audio=true}catch(e){result.audio=false;result.audioError=e.name}finally{await a.close()}return result;
  },audio);
  const download=async name=>{const wait=p.waitForEvent('download');await p.click('#compressDownload');await(await wait).saveAs(outputDir+'/'+name)};
  for(const type of ['mp4','webm']){
   const supported=await p.evaluate(type=>{try{return !!compressionFormat(type,true,t=>MediaRecorder.isTypeSupported(t))}catch{return false}},type);
   if(!supported){results[type]={unsupported:true};continue}
   await p.selectOption('#compressFormat',type);await p.click('#compressStart');await p.waitForFunction(()=>compression.job?.recorder?.state==='recording');
   if(type==='webm'){
    await p.click('#compressPause');await p.waitForFunction(()=>compression.job?.recorder?.state==='paused');await p.click('#compressPause');await p.waitForFunction(()=>compression.job?.recorder?.state==='recording');
    // Deterministic visibility branch check; this is not an OS background test.
    results.backgroundBranch=await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));const paused=compression.job.recorder.state==='paused';delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));return paused});assert.equal(results.backgroundBranch,true);
   }
   await p.waitForFunction(()=>!state.busy,undefined,{timeout:30000});const result=await measure(true);assert(result.audio&&result.rms>.02);assert(Number.isFinite(result.duration)&&Math.abs(result.duration-source.duration)<.7);assert.equal(result.width,852);assert.equal(result.height,480);assert(result.bytes<source.size);results[type]=result;await download('anonymous-result.'+type);
  }
  const webm=results.webm&&!results.webm.unsupported;
  if(webm){await p.setInputFiles('#fileInput',[outputDir+'/anonymous-result.webm']);await p.waitForFunction(()=>state.ready);results.webmReimport=await p.evaluate(()=>Number.isFinite(video.duration));assert.equal(results.webmReimport,true)}
  await p.click('#compressAudio');await p.selectOption('#compressFormat',results.mp4?.unsupported?'webm':'mp4');await p.click('#compressStart');await p.waitForFunction(()=>!state.busy,undefined,{timeout:30000});results.silent=await measure(false);assert.equal(results.silent.audio,false);assert(Number.isFinite(results.silent.duration));
  if(!webm){await p.setInputFiles('#fileInput',[videoPath]);await p.waitForFunction(()=>state.ready)}
  await p.evaluate(async()=>{video.currentTime=.2;video.volume=.35;video.muted=true;video.playbackRate=2;await video.play()});
  await p.click('#compressStart');await p.waitForFunction(()=>compression.job?.recorder?.state==='recording');await p.click('#compressCancel');await p.waitForFunction(()=>!state.busy&&!video.paused);
  results.cancel=await p.evaluate(()=>({job:!!compression.job,result:!!compression.result,decoders:document.querySelectorAll('.compression-source').length,paused:video.paused,volume:video.volume,muted:video.muted,speed:video.playbackRate}));assert.deepEqual(results.cancel,{job:false,result:false,decoders:0,paused:false,volume:.35,muted:true,speed:2});await p.evaluate(()=>video.pause());
  const offline=p.waitForEvent('download');await p.click('#downloadSiteBtn');await(await offline).saveAs(outputDir+'/offline.html');assert.equal(await fs.readFile(outputDir+'/offline.html','utf8'),await fs.readFile(htmlPath,'utf8'));results.offlineExact=true;
  await p.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});results.mobile=await p.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.equal(results.mobile.client,results.mobile.scroll);await p.screenshot({path:outputDir+'/mobile.png'});
  results.errors=await p.evaluate(()=>compressionErrors);assert.deepEqual(results.errors,[]);return results;
 }finally{await p.cdp('Emulation.clearDeviceMetricsOverride',{});await p.cdp('Emulation.setFocusEmulationEnabled',{enabled:false})}
}
