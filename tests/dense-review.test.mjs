import test from 'node:test';
import assert from 'node:assert/strict';
import {createTimestampPlan} from '../src/core/shots.js';
import {planAvcGroups, readAvcTrack} from '../src/core/mp4-avc.js';
import {compareReviewFrames} from '../src/core/shot-review.js';

test('timestamp lists accept pasted separators, sort, and merge equivalent times',()=>{
 assert.deepEqual(createTimestampPlan('00：00：03.125，1\n3.125；0  1.0',4),{
  times:[0,1,3.125],count:3,duplicates:2
 });
 assert.throws(()=>createTimestampPlan('1 00:60:00',100),/第 2 个时间点无效/);
 assert.throws(()=>createTimestampPlan('0 10',10),/小于视频时长/);
 assert.throws(()=>createTimestampPlan('0 1 2',10,2),/剩余容量 2 张/);
});

test('dense planning uses presentation order and leaves isolated targets for seek',()=>{
 const ticks=Array.from({length:200},(_,i)=>i);
 [ticks[61],ticks[62]]=[ticks[62],ticks[61]];
 const presentation=Uint32Array.from({length:ticks.length},(_,i)=>i).sort((a,b)=>ticks[a]-ticks[b]);
 const track={width:1920,height:1080,timescale:100,keys:[0,100],ticks,presentation};
 const times=[.581,.611,.621,.901,.951,1.7];
 assert.deepEqual([...planAvcGroups(track,times).values()],[
  {start:0,end:95,targets:[{time:.581,sample:58},{time:.611,sample:62},{time:.621,sample:61},{time:.901,sample:90},{time:.951,sample:95}]}
 ]);
 assert.equal(planAvcGroups(track,[.001,.011,.021,1.7]).size,0);
 ticks[96]=103;
 assert.equal(planAvcGroups(track,times).size,0);
});

test('an invalid MP4 box is rejected without starting decode',async()=>{
 await assert.rejects(readAvcTrack(new Blob([Uint8Array.of(0,0,0,4,109,111,111,118)])),/兼容定位/);
});

const side=40;
function pixels(sample){
 const rgba=new Uint8ClampedArray(side*side*4);
 for(let y=0;y<side;y++)for(let x=0;x<side;x++){
  const p=(y*side+x)*4;
  rgba.set([...sample(x,y),255],p);
 }
 return rgba;
}
const pattern=(x,y)=>[(x*53+y*43+x*y*3)%197,(x*15+y*71)%225,(x*34+y*29+x*y)%255];
test('review flags repeats, local changes, and scene cuts without suppressing images',()=>{
 const a=pixels(pattern), b=a.slice();
 assert.deepEqual(compareReviewFrames(a,b,side),{type:'duplicate'});
 for(let i=0;i<3;i++) b.set([255,255,255,255],4*(i+3));
 assert.deepEqual(compareReviewFrames(a,b,side),{type:'changed'});
 assert.deepEqual(compareReviewFrames(pixels(()=>[10,10,10]),pixels(()=>[220,220,220]),side),{type:'scene'});
});
test('review estimates overlap for scrolling and flags short overlap for checking',()=>{
 const a=pixels(pattern);
 assert.deepEqual(compareReviewFrames(a,pixels((x,y)=>pattern(x,y+10)),side),{type:'scroll',axis:'y',overlap:75});
 assert.deepEqual(compareReviewFrames(a,pixels((x,y)=>pattern(x+32,y)),side),{type:'gap',axis:'x',overlap:20});
});
