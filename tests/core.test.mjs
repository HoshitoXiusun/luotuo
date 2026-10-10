import test from 'node:test';
import assert from 'node:assert/strict';
import {assignShotNumbers,sortShots,parseTime,createCapturePlan} from '../src/core/shots.js';
import {audioRange,pcm16,encodeWav} from '../src/core/audio.js';
test('deleted screenshot numbers stay dense while ids remain stable',()=>{const shots=[{id:1},{id:2}];shots.pop();shots.push({id:3});assignShotNumbers(shots);assert.deepEqual(shots.map(s=>s.number),[1,2]);assert.deepEqual(shots.map(s=>s.id),[1,3])});
test('time sorting numbers out-of-order captures and renumbers earlier insertions',()=>{
 const source={name:'视频2.mp4',size:10,lastModified:1},shots=[{id:1,time:30,source},{id:2,time:10,source}];
 assignShotNumbers(shots);assert.deepEqual(sortShots(shots).map(s=>[s.id,s.number]),[[2,1],[1,2]]);
 shots.push({id:3,time:20,source});assignShotNumbers(shots);assert.deepEqual(sortShots(shots).map(s=>[s.id,s.number]),[[2,1],[3,2],[1,3]]);
 const removed=shots.splice(1,1)[0];assignShotNumbers(shots);assert.deepEqual(sortShots(shots).map(s=>s.number),[1,2]);
 shots.push(removed);assignShotNumbers(shots);assert.deepEqual(sortShots(shots).map(s=>[s.id,s.number]),[[2,1],[3,2],[1,3]]);
 assignShotNumbers(shots,'capture');assert.deepEqual(sortShots(shots,'capture').map(s=>[s.id,s.number]),[[3,1],[2,2],[1,3]]);
 assignShotNumbers(shots,'time');assert.deepEqual(sortShots(shots).map(s=>[s.id,s.number]),[[2,1],[3,2],[1,3]]);
});
test('source grouping uses natural file order and preserves same-time capture ids',()=>{
 const shots=[{id:4,time:1,source:{name:'视频10.mp4',size:10}},{id:3,time:1,source:{name:'视频2.mp4',size:20}},{id:2,time:1,source:{name:'视频2.mp4',size:10}},{id:1,time:1,source:{name:'视频2.mp4',size:10}}];
 assignShotNumbers(shots);assert.deepEqual(sortShots(shots).map(s=>[s.id,s.number]),[[1,1],[2,2],[3,3],[4,4]]);
 assert.deepEqual(shots.map(s=>s.id),[4,3,2,1]);
});
test('blank batch bounds cover the whole video and never sample its end',()=>{const p={mode:'time',start:'',end:'',step:1,frameRate:25,duration:4,capacity:200};assert.deepEqual(createCapturePlan(p).times,[0,1,2,3]);assert.equal(createCapturePlan({...p,mode:'frame',duration:.12}).count,3);assert.throws(()=>createCapturePlan({...p,duration:300}),/容量/);assert.equal(parseTime('00:01:03.500'),63.5)});
test('audio boundaries are exclusive at the end and validated',()=>{assert.deepEqual(audioRange('','',2),{start:0,end:2});assert.deepEqual(audioRange('0.5','00:00:01.500',2),{start:.5,end:1.5});for(const [a,b]of [['2','1'],['0','3'],['-1','1'],['0','0']])assert.throws(()=>audioRange(a,b,2),/范围/)});
test('PCM conversion clips correctly and handles invalid samples',()=>{assert.equal(pcm16(-1),-32768);assert.equal(pcm16(1),32767);assert.equal(pcm16(2),32767);assert.equal(pcm16(NaN),0)});
const fake=channels=>({numberOfChannels:channels.length,sampleRate:8000,length:4,getChannelData:i=>new Float32Array(channels[i])});
test('WAV contains actual stereo samples in the right channel order',async()=>{const bytes=await encodeWav(fake([[1,-1,.5,0],[-1,1,0,.5]]),{start:0,end:4/8000});const view=new DataView(bytes.buffer);assert.equal(new TextDecoder().decode(bytes.subarray(0,4)),'RIFF');assert.equal(view.getUint16(22,true),2);assert.equal(view.getUint32(24,true),8000);assert.equal(view.getUint32(40,true),16);assert.deepEqual(Array.from({length:8},(_,i)=>view.getInt16(44+i*2,true)),[32767,-32768,-32768,32767,16384,0,0,16384])});
test('WAV trims the selected range without changing the source samples',async()=>{const b=fake([[1,-1,.5,0]]),bytes=await encodeWav(b,{start:1/8000,end:3/8000});assert.equal(bytes.length,48);const v=new DataView(bytes.buffer);assert.equal(v.getInt16(44,true),-32768);assert.equal(v.getInt16(46,true),16384)});
test('audio export cancellation discards the unfinished result',async()=>{await assert.rejects(()=>encodeWav(fake([[0,0,0,0]]),{start:0,end:4/8000},()=>{},()=>true),/停止/)});
