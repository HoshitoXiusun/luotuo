import test from 'node:test';
import assert from 'node:assert/strict';
import {compressionPlan,compressionFormat,compressionChunk,compressionSink} from '../src/core/compression.js';
const source={width:1920,height:1080,duration:60,size:50000000};
test('compression scales landscape and portrait evenly without enlarging small videos',()=>{
 const a=compressionPlan(source),b=compressionPlan({...source,width:1080,height:1920}),small=compressionPlan({...source,width:321,height:181});assert.deepEqual([a.width,a.height],[1280,720]);assert.deepEqual([b.width,b.height],[720,1280]);assert.deepEqual([small.width,small.height],[320,180]);assert(a.estimatedBytes>0&&a.estimatedBytes<a.sourceBytes);
 for(const input of [{...source,duration:Infinity},{...source,width:0},{...source,resolution:999},{...source,fps:120},{...source,quality:'invalid'}])assert.throws(()=>compressionPlan(input),/无效/);
});
test('compression bitrate, audio and estimates track actual selected settings',()=>{
 const small=compressionPlan({...source,quality:'small'}),clear=compressionPlan({...source,quality:'clear'}),silent=compressionPlan({...source,audio:false});assert(small.videoBitsPerSecond<clear.videoBitsPerSecond);assert.equal(silent.audioBitsPerSecond,0);assert.equal(silent.estimatedBytes,Math.ceil(silent.videoBitsPerSecond*source.duration/8));
});
test('codec negotiation chooses a supported real container and never renames WebM to MP4',()=>{
 const f=compressionFormat('auto',true,type=>type==='video/webm;codecs=vp8,opus');assert.equal(f.extension,'webm');assert.match(f.mime,/webm/);assert.throws(()=>compressionFormat('mp4',true,()=>false),/不能编码 MP4/);assert.equal(compressionFormat('mp4',false,t=>t==='video/mp4').extension,'mp4');
});
const header=[0x1a,0x45,0xdf,0xa3,0x80,0x18,0x53,0x80,0x67,0xff],info=[0x15,0x49,0xa9,0x66,0x87,0x2a,0xd7,0xb1,0x83,0x0f,0x42,0x40],payload=[0x1f,0x43,0xb6,0x75,0x83,0xa3,0x81,0x11];
test('WebM duration finalization preserves encoded payload and replaces rather than duplicates duration',async()=>{
 const blob=new Blob([new Uint8Array([...header,...info,...payload])],{type:'video/webm'}),fixed=await compressionChunk(blob,8),bytes=new Uint8Array(await fixed.arrayBuffer());const at=bytes.findIndex((b,i)=>b===0x44&&bytes[i+1]===0x89&&bytes[i+2]===0x88);assert(at>0);assert.equal(new DataView(bytes.buffer).getFloat64(at+3,false),8000);assert.deepEqual([...bytes.slice(-payload.length)],payload);
 const again=await compressionChunk(fixed,10),b=new Uint8Array(await again.arrayBuffer());assert.equal(b.length,bytes.length);assert.equal(new DataView(b.buffer).getFloat64(at+3,false),10000);assert.equal(await compressionChunk(new Blob(['mp4']),2).then(b=>b.text()),'mp4');
});
test('WebM finalization rejects malformed or indexed native headers instead of corrupting offsets',async()=>{
 await assert.rejects(()=>compressionChunk(new Blob([new Uint8Array([...header,0x11,0x4d,0x9b,0x74,0x80,...info])]),2),/索引/);await assert.rejects(()=>compressionChunk(new Blob([new Uint8Array(header)]),2),/封装失败/);await assert.rejects(()=>compressionChunk(new Blob(['x']),Infinity),/时长无效/);
});
test('finalized WebM preserves every index offset while updating an existing duration',async()=>{
 const duration=new Uint8Array(11);duration.set([0x44,0x89,0x88]);new DataView(duration.buffer).setFloat64(3,2000,false);
 const indexed=[...header,0x11,0x4d,0x9b,0x74,0x80,0x15,0x49,0xa9,0x66,0x92,...info.slice(5),...duration,...payload];
 const original=new Uint8Array(indexed),fixed=new Uint8Array(await(await compressionChunk(new Blob([original]),9)).arrayBuffer());assert.equal(fixed.length,original.length);const at=fixed.findIndex((b,i)=>b===0x44&&fixed[i+1]===0x89);assert.equal(new DataView(fixed.buffer).getFloat64(at+3,false),9000);fixed.set(original.slice(at+3,at+11),at+3);assert.deepEqual(fixed,original);
});
test('compression memory sink enforces its limit and returns the real MIME type',async()=>{
 const sink=compressionSink({mime:'video/mp4',duration:2,maxBytes:4});await sink.push(new Blob(['ab']));await sink.push(new Blob(['cd']));const blob=await sink.finish();assert.equal(blob.type,'video/mp4');assert.equal(await blob.text(),'abcd');
 const limited=compressionSink({mime:'video/mp4',duration:2,maxBytes:3});await assert.rejects(()=>limited.push(new Blob(['abcd'])),/超过/);await limited.abort();
});
test('disk sink serializes writes, closes once, and aborts without committing cancelled output',async()=>{
 const writes=[];let closed=0,aborted=0;const writer={async write(b){await new Promise(r=>setTimeout(r,2));writes.push(await b.text())},async close(){closed++},async abort(){aborted++}};
 const sink=compressionSink({mime:'video/mp4',duration:2,writer});const a=sink.push(new Blob(['a'])),b=sink.push(new Blob(['b']));await Promise.all([a,b]);assert.equal(await sink.finish(),null);assert.deepEqual(writes,['a','b']);assert.equal(closed,1);
 const cancel=compressionSink({mime:'video/mp4',duration:2,writer});const pending=cancel.push(new Blob(['discard']));await cancel.abort();await pending;assert.deepEqual(writes,['a','b']);assert.equal(aborted,1);assert.equal(closed,1);await assert.rejects(()=>cancel.finish(),/关闭/);
});
