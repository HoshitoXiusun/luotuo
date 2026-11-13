import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export async function verifyBatchPerformance(task,{baselinePath,htmlPath,fixtures,outputDir}){
 const p=task.page('p1'),results={fixtures:[],errors:[]};
 await fs.mkdir(outputDir,{recursive:true});
 await p.cdp('Emulation.setFocusEmulationEnabled',{enabled:true});
 const load=async (html,videoPath)=>{
  await p.goto(pathToFileURL(html).href);
  await p.evaluate(()=>{window.errors=[];for(const type of ['error','unhandledrejection','securitypolicyviolation'])addEventListener(type,e=>errors.push(e.message||String(e.reason||e.violatedDirective)))});
  await p.setInputFiles('#fileInput',[videoPath]);
  await p.waitForFunction(()=>state.ready);
 };
 try{
  for(const {label,videoPath,count,step} of fixtures){
   const row={label,count,step,before:[],after:[]};let reference;
   for(let round=0;round<3;round++){
    for(const kind of (round===1?['after','before']:['before','after'])){
     await load(kind==='before'?baselinePath:htmlPath,videoPath);
     const run=await p.evaluate(async ({count,step})=>{
      await seek(.25);
      // Seed a real screenshot so the measured batch also exercises an existing card.
      await takeShot();renderGallery();
      const oldCard=document.querySelector('#gallery .card'),oldSeek=seek,oldBlob=canvasBlob,canvases=new Set();
      let active=0,peak=0,overlap=0,seekMs=0;
      seek=async t=>{if(active)overlap++;const start=performance.now();try{return await oldSeek(t)}finally{seekMs+=performance.now()-start}};
      canvasBlob=async (c,...args)=>{canvases.add(c);peak=Math.max(peak,++active);try{return await oldBlob(c,...args)}finally{active--}};
      const targets=Array.from({length:count},(_,i)=>Math.round((.4+i*step)*1000)/1000);
      currentCapturePlan=()=>({times:targets});
      const start=performance.now();await batch();const ms=performance.now()-start;
      const cards=[...document.querySelectorAll('#gallery .card')],retained=cards.includes(oldCard);
      const hashCanvas=document.createElement('canvas');hashCanvas.width=video.videoWidth;hashCanvas.height=video.videoHeight;
      const ctx=hashCanvas.getContext('2d',{willReadFrequently:true});
      const frames=[];
      for(const s of state.shots.slice(1)){
       const bitmap=await createImageBitmap(s.blob);ctx.clearRect(0,0,s.width,s.height);ctx.drawImage(bitmap,0,0);bitmap.close();
       const pixels=ctx.getImageData(0,0,s.width,s.height).data;
       const digest=await crypto.subtle.digest('SHA-256',pixels);
       frames.push({id:s.id,number:s.number,time:s.time,requestedTime:s.requestedTime,width:s.width,height:s.height,mime:s.blob.type,pixels:[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')});
      }
      const result={ms,seekMs,peak,overlap,canvases:canvases.size,retained,frames,targets,paused:video.paused,restoredTime:video.currentTime,cardCount:cards.length,errors};
      state.dirty=false;return result;
     },{count,step});
     assert.equal(run.frames.length,count);assert.equal(run.cardCount,count+1);assert.equal(run.paused,true);assert.equal(run.restoredTime,.25);
     assert.deepEqual(run.frames.map(f=>f.requestedTime),run.targets);assert.deepEqual(run.errors,[]);
     if(!reference)reference=run.frames;else assert.deepEqual(run.frames,reference,'Decoded RGBA pixels, timestamps, dimensions and ordering must match');
     if(kind==='after'){assert(run.canvases<=2);assert(run.peak<=2);assert(run.overlap>0);assert(run.retained)}
     const {frames,targets,...stats}=run;row[kind].push(stats);
    }
   }
   const median=xs=>xs.map(x=>x.ms).sort((a,b)=>a-b)[1];
   row.dimensions=[reference[0].width,reference[0].height];
   row.medianBefore=median(row.before);row.medianAfter=median(row.after);
   row.identicalFrames=reference.length;results.fixtures.push(row);await fs.writeFile(outputDir+'/results.json',JSON.stringify(results,null,2));
  }
  await load(htmlPath,fixtures[0].videoPath);
  await p.evaluate(async()=>{
   openMode('batch');$('toast').hidden=true;video.muted=true;await seek(.25);await video.play();
   const seekOriginal=seek;
   seek=async t=>{if(t===.8){await new Promise(resolve=>window.releaseSeek=resolve)}return seekOriginal(t)};
   currentCapturePlan=()=>({times:[.4,.8,1.2]});
   window.cancelBatch=batch();
  });
  await p.waitForFunction(()=>typeof window.releaseSeek==='function');
  await p.click('#cancelBtn');
  results.cancel=await p.evaluate(async()=>{releaseSeek();await cancelBatch;const r={shots:state.shots.map(s=>s.requestedTime),busy:state.busy,playing:!video.paused,time:video.currentTime,errors};video.pause();state.dirty=false;return r});
  assert.deepEqual(results.cancel.shots,[.4]);assert(!results.cancel.busy&&results.cancel.playing);assert(results.cancel.time>=.25&&results.cancel.time<.6);assert.deepEqual(results.cancel.errors,[]);
  const download=p.waitForEvent('download');await p.click('#downloadSiteBtn');await(await download).saveAs(outputDir+'/offline.html');
  assert.equal(await fs.readFile(outputDir+'/offline.html','utf8'),await fs.readFile(htmlPath,'utf8'));results.offlineExact=true;
  await fs.writeFile(outputDir+'/results.json',JSON.stringify(results,null,2));
  return results;
 }finally{await p.cdp('Emulation.setFocusEmulationEnabled',{enabled:false})}
}
