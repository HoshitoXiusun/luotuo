import test from 'node:test';
import assert from 'node:assert/strict';
import {displayGeometry,createFramePump} from '../src/core/video-display.js';
function harness({native=true,draw=()=>true}={}){
 const frames=new Map(),animations=new Map(),painted=[],errors=[];let id=0,clock=0,time=0,writes=0;
 const media={paused:false,ended:false,seeking:false,readyState:2,videoWidth:1080,videoHeight:1920,volume:.8,muted:false,get currentTime(){return time},set currentTime(t){writes++;time=t},play(){throw Error('display must not play media')},pause(){throw Error('display must not pause media')}};
 if(native){media.requestVideoFrameCallback=fn=>{frames.set(++id,fn);return id};media.cancelVideoFrameCallback=i=>frames.delete(i)}
 const pump=createFramePump(media,t=>{draw(t);painted.push(t);return true},{raf:fn=>{animations.set(++id,fn);return id},caf:i=>animations.delete(i),now:()=>clock,onError:error=>{errors.push(error.message);pump.stop()}});
 const frame=t=>{time=t;const [i,fn]=frames.entries().next().value;frames.delete(i);fn(clock,{mediaTime:t})};
 const tick=(ms,t=time)=>{clock=ms;time=t;const [i,fn]=animations.entries().next().value;animations.delete(i);fn(clock)};
 return {media,pump,frames,animations,painted,errors,frame,tick,setTime:t=>{time=t},get writes(){return writes}};
}
test('portrait display uses a fixed integer rectangle and bounded backing surface',()=>{
 const expected={width:1920,height:1080,x:656,y:0,drawWidth:608,drawHeight:1080};
 for(let i=0;i<100;i++)assert.deepEqual(displayGeometry(1080,1920,960,540,2),expected);
 const huge=displayGeometry(7680,4320,4000,2250,3);assert(huge.width<=1920&&huge.height<=1200&&huge.width*huge.height<=2102000);
 assert.equal(displayGeometry(0,1920,960,540,2),null);assert.equal(displayGeometry(1920,1080,0,0),null);
});
test('decoded callbacks paint in presentation order without changing media state',()=>{
 const h=harness();h.pump.start();h.frame(1);h.frame(.9);h.frame(1.1);
 assert.deepEqual(h.painted,[0,1,1.1]);assert.equal(h.frames.size,1);assert.equal(h.animations.size,1);assert.equal(h.writes,0);assert.equal(h.media.paused,false);assert.equal(h.media.volume,.8);assert.equal(h.media.muted,false);h.pump.stop();
});
test('stop and seek invalidate late callbacks and allow an earlier target',()=>{
 const h=harness();h.pump.start();const old=[...h.frames.values()][0];h.frame(30);h.pump.stop();h.setTime(5);h.pump.start();old(0,{mediaTime:31});h.frame(5.1);
 assert.deepEqual(h.painted,[0,30,5,5.1]);assert.equal(h.frames.size,1);assert.equal(h.animations.size,1);h.pump.stop();assert.equal(h.frames.size,0);assert.equal(h.animations.size,0);
});
test('watchdog paints when native callbacks stall, without repeated duplicate frames',()=>{
 const h=harness();h.pump.start();h.tick(300,.3);h.tick(316,.316);h.tick(350,.35);h.tick(390,.35);assert.deepEqual(h.painted,[0,.3,.35]);h.frame(.4);h.tick(450,.45);assert.deepEqual(h.painted,[0,.3,.35,.4]);h.pump.stop();
});
test('fallback works without video callbacks and never draws an unfinished seek',()=>{
 const h=harness({native:false});h.pump.start();h.tick(40,.04);h.media.seeking=true;h.tick(100,10);assert.deepEqual(h.painted,[0,.04]);h.media.seeking=false;h.media.paused=true;h.pump.stop();h.pump.paint();assert.deepEqual(h.painted,[0,.04,10]);assert.equal(h.animations.size,0);
});
test('drawing errors stop every scheduled callback',()=>{
 const h=harness({draw:()=>{throw Error('canvas unavailable')}});h.pump.start();assert.deepEqual(h.errors,['canvas unavailable']);assert.equal(h.animations.size,0);assert.equal(h.frames.size,0);
});
