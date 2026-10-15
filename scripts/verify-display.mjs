// Local-only regression for the stable presentation path. Fixture paths are
// inputs, never returned or saved; no user image is included in test reports.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
export async function verifyDisplay(task,{htmlPath,videoPath,start=300.061}){
 const p=task.page('p1');await p.cdp('Emulation.setFocusEmulationEnabled',{enabled:true});
 try{
  await p.goto(pathToFileURL(htmlPath).href);await p.waitForFunction(()=>!!document.getElementById('fileInput'));
  await p.setInputFiles('#fileInput',[videoPath]);await p.waitForFunction(()=>!document.getElementById('playBtn').disabled,undefined,{timeout:45000});
  await p.evaluate(async time=>{await navigate(time);document.getElementById('timeline').scrollIntoView({block:'center',behavior:'instant'});},start);
  const initial=await p.evaluate(()=>{
   const v=document.getElementById('video'),c=document.getElementById('videoCanvas'),s=document.getElementById('dropzone'),ctx=c.getContext('2d'),fn=ctx.drawImage.bind(ctx);
   window.displayTest={draws:[],events:[],errors:[]};ctx.drawImage=(...args)=>{displayTest.draws.push({time:v.currentTime,bounds:args.slice(1)});return fn(...args)};
   for(const e of ['pause','seeking'])v.addEventListener(e,()=>displayTest.events.push(e));for(const e of ['error','unhandledrejection','securitypolicyviolation'])window.addEventListener(e,x=>displayTest.errors.push(e+':'+(x.message||x.reason?.message||x.violatedDirective)));
   return {duration:v.duration,dimensions:[v.videoWidth,v.videoHeight],stable:document.getElementById('stablePlayback').checked,canvasVisible:!c.hidden,nativeBox:[v.clientWidth,v.clientHeight],screenBox:[s.clientWidth,s.clientHeight],surface:[c.width,c.height]};
  });
  assert(initial.duration>=3600);assert.equal(initial.stable,true);assert.equal(initial.canvasVisible,true);assert.deepEqual(initial.nativeBox,initial.screenBox);
  await p.click('#playBtn');await p.waitForFunction(time=>document.getElementById('video').currentTime>time+4,start,{timeout:10000});
  const playback=await p.evaluate(()=>({time:document.getElementById('video').currentTime,paused:document.getElementById('video').paused,volume:document.getElementById('video').volume,muted:document.getElementById('video').muted,draws:displayTest.draws.length,bounds:[...new Set(displayTest.draws.map(d=>d.bounds.join(',')))],backward:displayTest.draws.slice(1).filter((d,i)=>d.time<displayTest.draws[i].time).length,events:[...displayTest.events]}));
  assert.equal(playback.paused,false);assert.equal(playback.bounds.length,1);assert.equal(playback.backward,0);assert.deepEqual(playback.events,[]);assert(playback.draws>2);
  await p.evaluate(()=>new Promise(resolve=>{
   const v=document.getElementById('video');
   // pause() updates paused synchronously but queues its event. Wait for the
   // presentation listener to paint the final paused frame before comparing.
   v.addEventListener('pause',()=>requestAnimationFrame(()=>resolve()),{once:true});v.pause();
  }));
  const pixels=await p.evaluate(()=>{
   const v=document.getElementById('video'),c=document.getElementById('videoCanvas'),s=document.getElementById('dropzone'),g=displayGeometry(v.videoWidth,v.videoHeight,s.clientWidth,s.clientHeight,devicePixelRatio),expected=document.createElement('canvas');expected.width=c.width;expected.height=c.height;
   const ctx=expected.getContext('2d',{alpha:false});ctx.fillStyle='#20242d';ctx.fillRect(0,0,c.width,c.height);ctx.imageSmoothingQuality='high';ctx.drawImage(v,g.x,g.y,g.drawWidth,g.drawHeight);
   const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data,b=ctx.getImageData(0,0,c.width,c.height).data;let differences=0,maxChannelDelta=0;for(let i=0;i<a.length;i++){const delta=Math.abs(a[i]-b[i]);if(delta)differences++;maxChannelDelta=Math.max(maxChannelDelta,delta);}
   return {differences,maxChannelDelta,geometry:g};
  });assert(pixels.maxChannelDelta<=1,'Paused display must match the native frame within one 8-bit colour rounding level');
  await p.evaluate(async()=>{await capture()});const captureInfo=await p.evaluate(()=>{const shot=state.shots.at(-1);return {dimensions:[shot.width,shot.height],time:shot.time,paused:video.paused}});assert.deepEqual(captureInfo.dimensions,initial.dimensions);assert.equal(captureInfo.paused,true);
  const errors=await p.evaluate(()=>displayTest.errors);assert.deepEqual(errors,[]);return {initial,playback,pixels,capture:captureInfo,errors};
 }finally{await p.evaluate(()=>state.dirty=false);await p.cdp('Emulation.setFocusEmulationEnabled',{enabled:false})}
}
