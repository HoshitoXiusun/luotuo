import test from 'node:test';
import assert from 'node:assert/strict';
import {hoverTimeAt,previewPosition,createPreviewQueue} from '../src/core/hover-preview.js';
const until=async predicate=>{const end=Date.now()+1000;while(!predicate()){if(Date.now()>end)throw Error('Timed out');await new Promise(r=>setTimeout(r,1))}};
test('hover coordinates match thumb endpoints and clamp outside the track',()=>{
 const rect={left:100,width:214};assert.equal(hoverTimeAt(107,rect,3600),0);assert.equal(hoverTimeAt(207,rect,3600),1800);assert.equal(hoverTimeAt(307,rect,3600),3600);
 assert.equal(hoverTimeAt(-1,rect,3600),0);assert.equal(hoverTimeAt(900,rect,3600),3600);
 for(const duration of [0,-1,NaN,Infinity])assert.equal(hoverTimeAt(200,rect,duration),null);
 assert.equal(hoverTimeAt(200,{left:0,width:0},5),null);
});
test('hover panel stays inside viewport, above the track when possible',()=>{
 const rect={top:300,bottom:318};assert.deepEqual(previewPosition(300,rect,232,160,800,700),{left:184,top:128});
 assert.equal(previewPosition(5,rect,232,160,390,700).left,12);assert.equal(previewPosition(390,rect,232,160,390,700).left,146);
 assert.equal(previewPosition(100,{top:20,bottom:38},232,160,390,700).top,50);
 assert.equal(previewPosition(100,{top:20,bottom:38},232,160,390,180).top,12);
});
test('rapid pointer requests keep one active seek and the latest pending target',async()=>{
 const renders=[],commits=[],errors=[];let release;
 const queue=createPreviewQueue(async(target)=>{renders.push(target);if(target===1)await new Promise(r=>release=r);return target},(frame,target,info)=>commits.push({frame,target,latest:info.latest}),error=>errors.push(error),0);
 queue.request(1);await until(()=>renders.length===1);
 for(let i=2;i<=100;i++)queue.request(i);
 assert.deepEqual(renders,[1]);release();await until(()=>commits.length===2);
 assert.deepEqual(renders,[1,100]);assert.deepEqual(commits,[{frame:1,target:1,latest:false},{frame:100,target:100,latest:true}]);assert.deepEqual(errors,[]);queue.cancel();
});
test('leaving or switching source aborts in-flight work and suppresses late frames',async()=>{
 const commits=[],errors=[];let aborted=false,started=false;
 const queue=createPreviewQueue((target,signal)=>target===1?new Promise((resolve,reject)=>{started=true;signal.addEventListener('abort',()=>{aborted=true;reject(Error('cancelled'))})}):Promise.resolve(target),frame=>commits.push(frame),error=>errors.push(error),0);
 queue.request(1);await until(()=>started);queue.cancel();queue.request(2);await until(()=>commits.length===1);
 assert.equal(aborted,true);assert.deepEqual(commits,[2]);assert.deepEqual(errors,[]);queue.cancel();
});
test('cancel before lazy load prevents decoder work; a failed preview can recover',async()=>{
 const calls=[],commits=[],errors=[];
 const queue=createPreviewQueue(async target=>{calls.push(target);if(target===2)throw Error('decode failed');return target},frame=>commits.push(frame),error=>errors.push(error.message),0);
 queue.request(1);queue.cancel();queue.request(2);await until(()=>errors.length===1);queue.request(3);await until(()=>commits.length===1);
 assert.deepEqual(calls,[2,3]);assert.deepEqual(errors,['decode failed']);assert.deepEqual(commits,[3]);queue.cancel();
});
