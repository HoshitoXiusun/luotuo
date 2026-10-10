// Optional real-browser regression. Call verifyLayout(existingTaskSpace, options)
// from ego-browser nodejs; it does not create/claim/finish a browser task.
// Fixtures remain local and are never sent to the site or included in the build.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
export async function verifyLayout(task,{htmlPath,videoPath,portraitPath,widths=[1470,900,761,760,390]}){
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'frame-notes-layout-'));
 const named=path.join(temp,'2026年视频记录_会议第一部分_完整录像_用于长文件名与本地视频布局回归测试.webm');
 try{await fs.link(videoPath,named)}catch{await fs.copyFile(videoPath,named)}
 const broken=path.join(temp,'invalid-video.webm');await fs.writeFile(broken,'invalid media');
 const p=task.page('p1'),results=[];
 try{
  for(const width of widths){
   await p.cdp('Emulation.setDeviceMetricsOverride',{width,height:850,deviceScaleFactor:1,mobile:false});
   await p.goto(pathToFileURL(htmlPath).href);
   await p.waitForFunction(()=>!!document.getElementById('fileInput'));
   await p.evaluate(()=>{
    const screen=document.getElementById('dropzone'),player=document.querySelector('.player-panel');
    window.scrollTo({top:screen.getBoundingClientRect().top+scrollY,behavior:'instant'});
    const rect=el=>{const r=el.getBoundingClientRect();return [r.left,r.top,r.width,r.height]};
    window.layoutProbe={baseline:rect(player),screen:rect(screen),scroll:scrollY,changes:[],events:[]};
    const sample=event=>{
     const b=rect(player),s=rect(screen),v=document.getElementById('video');
     const row={event,player:b,screen:s,scroll:scrollY,paused:v.paused,time:v.currentTime};
     if(b.some((n,i)=>Math.abs(n-layoutProbe.baseline[i])>.02)||s.some((n,i)=>Math.abs(n-layoutProbe.screen[i])>.02)||scrollY!==layoutProbe.scroll)layoutProbe.changes.push(row);
     if(event!=='frame')layoutProbe.events.push(row);
    };
    layoutProbe.sample=sample;layoutProbe.active=true;
    const tick=()=>{sample('frame');if(layoutProbe.active)requestAnimationFrame(tick)};tick();
    for(const ev of ['loadstart','loadedmetadata','loadeddata','resize','error','play','pause','seeked'])document.getElementById('video').addEventListener(ev,()=>sample(ev));
   });
   await p.setInputFiles('#fileInput',[named]);
   await p.waitForFunction(()=>!document.getElementById('playBtn').disabled,undefined,{timeout:45000});
   const duration=await p.evaluate(()=>document.getElementById('video').duration);
   assert(duration>3600,'Use an actual >1-hour fixture for this regression');
   await p.click('#playBtn');
   await p.waitForFunction(()=>document.getElementById('video').currentTime>.6);
   await p.evaluate(()=>document.getElementById('video').currentTime=3599);
   await p.waitForFunction(()=>!document.getElementById('video').seeking&&document.getElementById('video').currentTime>3600);
   await p.evaluate(()=>document.getElementById('video').pause());
   if(portraitPath){await p.setInputFiles('#fileInput',[portraitPath]);await p.waitForFunction(()=>!document.getElementById('playBtn').disabled);}
   await p.setInputFiles('#fileInput',[broken]);
   await p.waitForFunction(()=>document.getElementById('videoMeta').textContent==='视频读取失败');
   const result=await p.evaluate(()=>{layoutProbe.sample('done');layoutProbe.active=false;return {baseline:layoutProbe.baseline,screen:layoutProbe.screen,changes:layoutProbe.changes,events:layoutProbe.events.map(e=>e.event),overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth}});
   assert.deepEqual(result.changes,[],`Player or scroll moved at ${width}px`);assert.equal(result.overflow,false,`Horizontal overflow at ${width}px`);
   results.push({width,...result});
  }
  return results;
 }finally{await p.cdp('Emulation.clearDeviceMetricsOverride',{});await fs.rm(temp,{recursive:true,force:true})}
}
