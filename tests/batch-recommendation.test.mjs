import test from 'node:test';
import assert from 'node:assert/strict';
import {batchRecommendation} from '../src/core/batch-recommendation.js';
import {createCapturePlan} from '../src/core/shots.js';
test('duration-based recommendations expose seconds and conversion FPS without exceeding overview target',()=>{
 const short=batchRecommendation(60),medium=batchRecommendation(480),long=batchRecommendation(4380);assert.equal(short.frameRate,30);assert.equal(medium.frameRate,25);assert.equal(long.frameRate,10);assert.equal(medium.interval,5);assert.equal(long.interval,60);assert.equal(long.frameStep,600);assert.equal(long.timeCount,73);
});
test('recommended time and frame settings are executable within remaining gallery capacity',()=>{
 for(const duration of [.001,.1,1,59.999,60,60.001,600,600.001,3600,3600.001,4380,36000,1e9])for(const capacity of [1,2,5,119,120,199,200]){
  const r=batchRecommendation(duration,capacity);for(const mode of ['time','frame']){const plan=createCapturePlan({mode,start:'',end:'',step:mode==='time'?r.interval:r.frameStep,frameRate:r.frameRate,duration,capacity});assert(plan.count<=Math.min(120,capacity));assert.equal(plan.count,mode==='time'?r.timeCount:r.frameCount);assert(plan.times.every(t=>t>=0&&t<duration))}
 }
});
test('longer videos use no smaller overview interval and all presets keep FPS in the supported range',()=>{
 let previous=0;for(const duration of [.1,1,60,300,600,1800,3600,7200,36000,360000]){const r=batchRecommendation(duration);assert(r.interval>=previous);assert(r.frameRate>=1&&r.frameRate<=240);assert(Number.isInteger(r.frameStep));previous=r.interval}
});
test('full gallery gives no actionable recommendation and invalid metadata is rejected',()=>{
 assert.equal(batchRecommendation(600,0),null);for(const duration of [0,-1,NaN,Infinity])assert.throws(()=>batchRecommendation(duration),/无效/);for(const capacity of [-1,.5,201,Infinity])assert.throws(()=>batchRecommendation(600,capacity),/无效/);
});
