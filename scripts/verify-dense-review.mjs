import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export async function verifyDenseReview(task,{htmlPath,baselinePath,fixtures,outputDir}){
 const page=task.page('p1'),results={fixtures:[]};
 await fs.mkdir(outputDir,{recursive:true});
 await page.cdp('Emulation.setFocusEmulationEnabled',{enabled:true});
 try{
  for(const fixture of fixtures){
   const {name,file,times,expectFast}=fixture;
   const records=[];
   let reference;
   for(const baseline of [true,false,false,true,true,false]){
    await page.goto(pathToFileURL(baseline?baselinePath:htmlPath).href);
    await page.setInputFiles('#fileInput',[file]);
    await page.waitForFunction(()=>state.ready);
    const run=await page.evaluate(async ({baseline,times})=>{
     await seek(.25);
     openMode('batch');
     if(baseline)currentCapturePlan=()=>({times});
     else {
      $('batchMode').value='list';$('batchMode').dispatchEvent(new Event('change'));
      $('timestampList').value=[...times].reverse().concat(times[0]).join('，');
      $('timestampList').dispatchEvent(new Event('input'));
     }
     const estimate=$('batchEstimate').textContent, start=performance.now();
     await batch();
     const ms=performance.now()-start;
     const canvas=document.createElement('canvas');
     canvas.width=video.videoWidth;canvas.height=video.videoHeight;
     const ctx=canvas.getContext('2d',{willReadFrequently:true});
     const shots=[];
     for(const s of state.shots){
      const bitmap=await createImageBitmap(s.blob);ctx.clearRect(0,0,s.width,s.height);ctx.drawImage(bitmap,0,0);bitmap.close();
      const rgba=ctx.getImageData(0,0,s.width,s.height).data;
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',rgba)),n=>n.toString(16).padStart(2,'0')).join('');
      shots.push({time:s.time,request:s.requestedTime,pts:s.presentationTime??null,width:s.width,height:s.height,hash});
     }
     state.dirty=false;
     return {ms,shots,estimate,restored:video.currentTime,cards:$('gallery').querySelectorAll('.card').length};
    },{baseline,times});
    assert.equal(run.restored,.25);assert.equal(run.cards,times.length);assert.deepEqual(run.shots.map(s=>s.request),times);
    const frames=run.shots.map(({pts,...frame})=>frame);
    if(!reference)reference=frames;
    else assert.deepEqual(frames,reference,`${name} frame pixels, position and order`);
    const fast=run.shots.filter(s=>s.pts!==null).length;
    if(!baseline){
     assert.match(run.estimate,/合并 1 个重复点/);
     assert.equal(fast,expectFast);
     assert(run.shots.every(s=>s.pts===null||s.pts<=s.request+1e-7));
    }
    records.push({baseline,ms:run.ms,fast});
   }
   const median=mode=>records.filter(r=>r.baseline===mode).map(r=>r.ms).sort((a,b)=>a-b)[1];
   results.fixtures.push({name,count:times.length,baselineMs:median(true),newMs:median(false),records,exactRGBA:true});
  }
  await page.goto(pathToFileURL(htmlPath).href);
  await page.setInputFiles('#fileInput',[fixtures[0].file]);
  await page.waitForFunction(()=>state.ready);
  const review=await page.evaluate(async ()=>{
   // Feed real PNG blobs through the UI. A four-frame sequence gives a
   // repeat, a localized change, and a scene cut in chronological order.
   for(let i=0;i<4;i++){
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=96;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle=i===3?'#fff':'#181818';ctx.fillRect(0,0,96,96);
    if(i===2){ctx.fillStyle='red';ctx.fillRect(42,42,5,5);}
    storeShot({width:96,height:96,blob:await canvasBlob(canvas),source:{...state.source},time:i,requestedTime:i,fps:25,decision:'keep',watermark:'off',createdAt:new Date().toISOString(),note:''});
   }
   renderGallery();await $('analyzeShots').onclick();
   const badges=[...$('gallery').querySelectorAll('.review-badge')].filter(e=>!e.hidden).map(e=>e.dataset.type).sort();
   const noAutomaticExclusion=shotsForExport().length===4;
   await openPreview(state.shots[1].id);
   const reason=$('previewReviewReason').textContent;
   await $('previewReviewCompare').onclick();
   const opensReference=state.previewId===state.shots[0].id;
   await openPreview(state.shots[1].id);$('previewReviewDecision').click();
   const manual=state.shots[1].decision;
   $('preview').close();undoAction();
   const restored=state.shots[1].decision;
   state.dirty=false;
   return {badges,noAutomaticExclusion,reason,opensReference,manual,restored};
  });
  assert.deepEqual(review.badges,['changed','duplicate','scene']);
  assert(review.noAutomaticExclusion&&review.opensReference);assert.match(review.reason,/与 #\d{3} 对比/);
  assert.equal(review.manual,'exclude');assert.equal(review.restored,'keep');
  results.review=review;
  const download=page.waitForEvent('download');
  await page.click('#downloadSiteBtn');
  const saved=outputDir+'/offline.html';await (await download).saveAs(saved);
  assert.deepEqual(await fs.readFile(saved),await fs.readFile(htmlPath));
  results.offlineExact=true;
  await fs.writeFile(outputDir+'/results.json',JSON.stringify(results,null,2));
  return results;
 } finally {await page.cdp('Emulation.setFocusEmulationEnabled',{enabled:false});}
}
