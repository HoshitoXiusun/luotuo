import test from 'node:test';
import assert from 'node:assert/strict';
import {runBatchPipeline} from '../src/core/batch-pipeline.js';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}};

test('pipeline overlaps one seek with encoding and never reuses a busy canvas or commits out of order',async()=>{
 const jobs=[],seeks=[],commits=[],slots=new Set();
 const finished=runBatchPipeline([1,2,3],{
  seekTo:async t=>{seeks.push(t)},
  encode:(time,slot)=>{assert(!slots.has(slot));slots.add(slot);const job=deferred();jobs.push({time,slot,...job});return job.promise.finally(()=>slots.delete(slot))},
  commit:value=>commits.push(value)
 });
 await tick();assert.deepEqual(seeks,[1,2]);assert.equal(slots.size,2);
 jobs[1].resolve(2);await tick();assert.deepEqual(commits,[]);assert.deepEqual(seeks,[1,2]);
 jobs[0].resolve(1);await tick();assert.deepEqual(seeks,[1,2,3]);
 jobs[2].resolve(3);await finished;assert.deepEqual(commits,[1,2,3]);assert.equal(slots.size,0);
});

test('cancel during a seek saves drawn frames and never draws the cancelled target',async()=>{
 const secondSeek=deferred(),png=deferred(),drawn=[],commits=[];let stop=false;
 const finished=runBatchPipeline([1,2,3],{
  seekTo:t=>t===2?secondSeek.promise:undefined,encode:t=>{drawn.push(t);return png.promise},commit:t=>commits.push(t),cancelled:()=>stop
 });
 await tick();stop=true;secondSeek.resolve();png.resolve(1);await finished;
 assert.deepEqual(drawn,[1]);assert.deepEqual(commits,[1]);
});

test('encoding failure waits for the other encoder before returning and does not commit a later frame',async()=>{
 const first=deferred(),second=deferred(),commits=[];let done=false;
 const failed=assert.rejects(runBatchPipeline([1,2,3],{
  seekTo:()=>{},encode:t=>t===1?first.promise:second.promise,commit:t=>commits.push(t)
 }),/PNG failure/).then(()=>done=true);
 await tick();first.reject(Error('PNG failure'));await tick();assert.equal(done,false);
 second.resolve(2);await failed;assert.deepEqual(commits,[]);
});
