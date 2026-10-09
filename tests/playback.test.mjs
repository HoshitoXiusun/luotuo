import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
const videoSource=await fs.readFile(new URL('../src/video.js',import.meta.url),'utf8');
const audioSource=await fs.readFile(new URL('../src/audio.js',import.meta.url),'utf8');
function harness(){
 const elements=new Map(),listeners={};let time=10;
 const video={paused:false,duration:60,seeking:false,readyState:2,volume:.8,muted:false,audioTracks:[{enabled:false}],pauseCount:0,playCount:0,
  pause(){this.paused=true;this.pauseCount++},async play(){this.paused=false;this.playCount++},removeAttribute(){},
  addEventListener(name,fn){(listeners[name]??=new Set()).add(fn)},removeEventListener(name,fn){listeners[name]?.delete(fn)},
  get currentTime(){return time},set currentTime(t){time=t;queueMicrotask(()=>{for(const fn of [...listeners.seeked??[]])fn()})}};
 const element=id=>{if(!elements.has(id))elements.set(id,{id,tagName:'INPUT',value:id==='fps'?'25':id==='volume'?'80':'',textContent:'',checked:false,hidden:false,disabled:false,addEventListener(){}});return elements.get(id)};
 elements.set('video',video);const keyboard=[];
 const context=vm.createContext({document:{getElementById:element,activeElement:{tagName:'BODY'},querySelector:()=>null,addEventListener:(name,fn)=>{if(name==='keydown')keyboard.push(fn)}},window:{addEventListener(){}},setTimeout,clearTimeout,queueMicrotask,console,Blob,URL,Date});
 vm.runInContext(videoSource+'\n'+audioSource+'\nstate.ready=true;updateControls=()=>{};syncTime=()=>{};',context);
 return{video,element,context,run:code=>vm.runInContext(code,context),key:async(key,active={tagName:'BODY'})=>{context.document.activeElement=active;const e={key,preventDefault(){this.defaultPrevented=true}};keyboard[0](e);await new Promise(resolve=>setImmediate(resolve));return e}};
}
test('normal seeks preserve playing and paused states; frame step explicitly pauses',async()=>{
 const h=harness();await h.run('navigate(20)');assert.equal(h.video.currentTime,20);assert.equal(h.video.paused,false);assert.equal(h.video.pauseCount,0);
 h.video.paused=true;await h.run('navigate(15)');assert.equal(h.video.paused,true);assert.equal(h.video.playCount,0);
 h.video.paused=false;await h.run('navigate(15.04,{pause:true})');assert.equal(h.video.paused,true);assert.equal(h.video.pauseCount,1);
});
test('left/right seek by three seconds with a focused play button or timeline and clamp at bounds',async()=>{
 const h=harness();await h.key('ArrowRight',{tagName:'BUTTON',id:'playBtn'});assert.equal(h.video.currentTime,13);assert.equal(h.video.paused,false);
 await h.key('ArrowLeft',{tagName:'INPUT',id:'timeline'});assert.equal(h.video.currentTime,10);
 await h.run('navigate(1)');await h.key('ArrowLeft');assert.equal(h.video.currentTime,0);
 await h.run('navigate(59)');await h.key('ArrowRight');assert(h.video.currentTime<60&&h.video.currentTime>59.99);
 await h.key('ArrowLeft',{tagName:'INPUT',id:'jumpTime'});assert(h.video.currentTime>59.99);
});
test('raising volume cancels mute and unmuting zero restores audible volume',()=>{
 const h=harness();h.video.muted=true;h.element('volume').value='35';h.element('volume').oninput();assert.equal(h.video.muted,false);assert.equal(h.video.volume,.35);assert.equal(h.video.audioTracks[0].enabled,true);
 h.element('volume').value='0';h.element('volume').oninput();h.run('setPlaybackMuted(false)');assert.equal(h.video.volume,.35);assert.equal(h.element('volume').value,35);assert.equal(h.element('volumeValue').textContent,'35%');
});
test('new source and restore sound reset native mute, zero volume and disabled audio track',async()=>{
 const h=harness();h.video.muted=true;h.video.defaultMuted=true;h.video.volume=0;h.run('resetPlaybackAudio()');assert.equal(h.video.volume,.8);assert.equal(h.video.muted,false);assert.equal(h.video.defaultMuted,false);assert.equal(h.element('muted').checked,false);assert.equal(h.element('volumeValue').textContent,'80%');
 h.context.toast=()=>{};h.video.paused=true;await h.element('restoreSound').onclick();assert.equal(h.video.paused,false);assert.equal(h.video.playCount,1);
});
