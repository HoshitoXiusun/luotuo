import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

export async function verifyV150(task,{root,outputDir}){
 const p=task.page('p1'),report={};
 const url=pathToFileURL(root+'/index.html').href;
 await p.cdp('Emulation.setFocusEmulationEnabled',{enabled:true});
 const load=async file=>{
  await p.goto(url);
  await p.evaluate(()=>{window.qaErrors=[];for(const name of ['error','unhandledrejection','securitypolicyviolation'])addEventListener(name,e=>qaErrors.push(e.message||String(e.reason||e.violatedDirective)))});
  await p.setInputFiles('#fileInput',[file]);
  await p.waitForFunction(()=>state.ready);
 };
 try{
  await load(outputDir+'/portrait.mp4');
  report.quality=await p.evaluate(async()=>{
   await seek(.5);await takeShot();
   const first=state.shots[0];
   $('captureFormat').value='jpeg';$('captureMaxEdge').value='960';$('captureQuality').value=35;updateCaptureOptions();
   await takeShot();
   const low=state.shots.at(-1);
   $('captureQuality').value=95;await takeShot();const high=state.shots.at(-1);
   renderGallery();
   const original=save;let saved;
   save=async blob=>{saved=blob;return true};
   try{await saveProject()}finally{save=original}
   const parsed=await parseProject(saved);
   const timeout=performance.now()+10000;
   while([...$('gallery').querySelectorAll('img')].some(img=>!img.src.startsWith('data:image/jpeg'))){
    if(performance.now()>timeout)throw Error('后台缩略图未生成');
    await new Promise(resolve=>setTimeout(resolve,10));
   }
   const result={native:[first.width,first.height],sizes:[low.width,low.height],low:low.blob.size,high:high.blob.size,mime:low.blob.type,parsed:parsed.shots.map(s=>s.blob.type),settings:parsed.settings,thumbnails:[...$('gallery').querySelectorAll('img')].every(img=>img.src.startsWith('data:image/jpeg'))};
   for(const shot of parsed.shots)URL.revokeObjectURL(shot.url);
   state.dirty=false;return result;
  });
  assert.deepEqual(report.quality.native,[1080,1920]);assert.deepEqual(report.quality.sizes,[540,960]);
  assert(report.quality.low<report.quality.high);assert.equal(report.quality.mime,'image/jpeg');
  assert.deepEqual(report.quality.parsed.sort(),['image/jpeg','image/jpeg','image/png']);assert(report.quality.thumbnails);
  await load(outputDir+'/tiny.mp4');
  await p.evaluate(()=>{openMode('batch');$('batchStep').value=.04;$('autoReview').checked=false;window.qaStart=performance.now();window.qaBatch=batch()});
  for(let attempt=0;attempt<3;attempt++){
   try{await p.waitForFunction(()=>!state.busy&&state.shots.length===2000,undefined,{timeout:55000});break}
   catch(error){const progress=await p.evaluate(()=>({count:state.shots.length,busy:state.busy,status:$('batchStatus').textContent}));if(!progress.busy||attempt===2)throw error;console.log(progress)}
  }
  report.capacity=await p.evaluate(async()=>{
   await qaBatch;
   const ms=performance.now()-qaStart,firstPage=$('gallery').querySelectorAll('.card').length;
   for(let i=0;i<19;i++)$('galleryNext').click();
   const lastPage=[$('galleryPageLabel').textContent,$('gallery').querySelectorAll('.card').length];
   let cap='';try{await takeShot()}catch(e){cap=e.message}
   const original=save;let saved;
   save=async blob=>{saved=blob;return true};
   try{await saveProject()}finally{save=original}
   const parsed=await parseProject(saved),restored=parsed.shots.length;
   for(const shot of parsed.shots)URL.revokeObjectURL(shot.url);
   const originalUrls=state.shots.map(s=>s.url);
   state.shots=state.shots.slice(0,4);
   for(const url of originalUrls.slice(4))URL.revokeObjectURL(url);
   galleryPage=0;renderGallery();
   $('filenameTemplate').value='证据_{number}_{time}';
   state.shots[0].selected=state.shots[2].selected=true;
   let zip;
   save=async(blob,name)=>{zip={blob,name};return true};
   try{await exportZip()}finally{save=original}
   const filenames=shotsForExport().map(shot=>filename(shot));
   const bytes=Array.from(new Uint8Array(await zip.blob.arrayBuffer()));
   $('filenameTemplate').value='';const defaultName=filename(state.shots[0]);
   state.dirty=false;
   return {ms,count:restored,firstPage,lastPage,cap,filenames,defaultName,zipBytes:bytes,errors:qaErrors};
  });
  assert.equal(report.capacity.count,2000);assert.equal(report.capacity.firstPage,100);assert.match(report.capacity.lastPage[0],/1901–2000/);
  assert.match(report.capacity.cap,/2000/);assert.equal(report.capacity.filenames.length,2);
  assert(report.capacity.filenames.every(name=>/^证据_\d+_/.test(name)));assert.match(report.capacity.defaultName,/^视频截图_/);
  assert.deepEqual(report.capacity.errors,[]);
  await fs.writeFile(outputDir+'/custom-names.zip',new Uint8Array(report.capacity.zipBytes));delete report.capacity.zipBytes;
  await load(outputDir+'/static.mp4');
  await p.evaluate(()=>{openMode('batch');$('batchStep').value=.25;window.qaReview=batch()});
  await p.waitForFunction(()=>!state.busy&&state.shots.length===8&&reviewResult(state.shots[1]),undefined,{timeout:30000});
  report.review=await p.evaluate(async()=>{
   await qaReview;
   const suggested=state.shots.filter(s=>reviewResult(s)?.type==='duplicate').length;
   const before=shotsForExport().length;
   $('applyReviewExclusions').click();const after=shotsForExport().length;
   undoAction();const undone=shotsForExport().length;
   const original=state.shots[0];
   // An exact repeated image separated by another image remains reviewable.
   const canvas=document.createElement('canvas');canvas.width=canvas.height=96;canvas.getContext('2d').fillRect(0,0,96,96);
   const change=await canvasBlob(canvas);
   state.shots[1].blob=change;
   await analyzeShots();
   const nonAdjacent=reviewResult(state.shots[2]);
   const result={suggested,before,after,undone,nonAdjacent:nonAdjacent?.previous.id===original.id,reason:nonAdjacent?reviewReason(nonAdjacent):'',errors:qaErrors};
   state.dirty=false;return result;
  });
  assert.equal(report.review.suggested,7);assert.equal(report.review.before,8);assert.equal(report.review.after,1);assert.equal(report.review.undone,8);assert(report.review.nonAdjacent);assert.deepEqual(report.review.errors,[]);
  const download=p.waitForEvent('download');await p.click('#downloadSiteBtn');await(await download).saveAs(outputDir+'/offline.html');
  assert.deepEqual(await fs.readFile(outputDir+'/offline.html'),await fs.readFile(root+'/index.html'));report.offlineExact=true;
  await fs.writeFile(outputDir+'/results.json',JSON.stringify(report,null,2));
  return report;
 }finally{await p.cdp('Emulation.setFocusEmulationEnabled',{enabled:false})}
}
