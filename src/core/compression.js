export function compressionPlan({width,height,duration,size,resolution=720,quality='balanced',fps=24,audio=true}){
 if(![width,height,duration,size].every(n=>Number.isFinite(n)&&n>0)||width<2||height<2)throw Error('视频尺寸、时长或文件大小无效');
 if(![480,720,1080].includes(resolution)||!['small','balanced','clear'].includes(quality)||![15,24,30].includes(fps)||typeof audio!=='boolean')throw Error('压缩设置无效');
 const bound=width>=height?[resolution*16/9,resolution]:[resolution,resolution*16/9],scale=Math.min(1,bound[0]/width,bound[1]/height);
 const w=Math.max(2,Math.floor(width*scale/2)*2),h=Math.max(2,Math.floor(height*scale/2)*2),factor={small:.035,balanced:.07,clear:.12}[quality];
 const videoBitsPerSecond=Math.round(Math.max(120000,Math.min(12000000,w*h*fps*factor))),audioBitsPerSecond=audio?96000:0;
 return {width:w,height:h,fps,videoBitsPerSecond,audioBitsPerSecond,duration,estimatedBytes:Math.ceil((videoBitsPerSecond+audioBitsPerSecond)*duration/8),sourceBytes:size,audio};
}
export function compressionFormat(choice,audio,supported){
 if(!['auto','mp4','webm'].includes(choice))throw Error('输出格式无效');
 const mp4=audio?['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4']:['video/mp4;codecs=avc1.42E01E','video/mp4'];
 const webm=audio?['video/webm;codecs=vp8,opus','video/webm;codecs=vp9,opus','video/webm']:['video/webm;codecs=vp8','video/webm;codecs=vp9','video/webm'];
 const mime=(choice==='mp4'?mp4:choice==='webm'?webm:[...mp4,...webm]).find(type=>supported(type));
 if(!mime)throw Error(choice==='mp4'?'此浏览器不能编码 MP4，请选择自动或 WebM':'此浏览器不支持本地视频编码，请使用更新版本的 Chrome / Edge / Firefox');
 return {mime,extension:mime.startsWith('video/mp4')?'mp4':'webm'};
}
function ebmlElement(bytes,offset){
 const start=offset;if(offset>=bytes.length)return null;let mask=128,idLength=1;while(idLength<=4&&!(bytes[offset]&mask)){idLength++;mask>>=1}if(idLength>4||offset+idLength>=bytes.length)return null;
 let id=0;for(let i=0;i<idLength;i++)id=id*256+bytes[offset++];mask=128;let length=1;while(length<=8&&!(bytes[offset]&mask)){length++;mask>>=1}if(length>8||offset+length>bytes.length)return null;
 const sizeStart=offset;let size=bytes[offset++]&(mask-1),unknown=size===mask-1;for(let i=1;i<length;i++){unknown=unknown&&bytes[offset]===255;size=size*256+bytes[offset++]}return {start,id,sizeStart,sizeLength:length,payload:offset,size:unknown?null:size,end:unknown?null:offset+size};
}
function ebmlSize(size){let length=1;while(size>=2**(7*length)-1)length++;const out=new Uint8Array(length);for(let i=length-1;i>=0;i--){out[i]=size%256;size=Math.floor(size/256)}out[0]|=1<<(8-length);return out}
// Native MediaRecorder WebM omits Duration in some browsers. Only rewrite its
// first Info header, not media payloads or arbitrary user files / indexed WebM.
export async function compressionChunk(blob,duration){
 if(!Number.isFinite(duration)||duration<=0)throw Error('压缩时长无效');
 const bytes=new Uint8Array(await blob.slice(0,65536).arrayBuffer());let first=ebmlElement(bytes,0);if(first?.id!==0x1a45dfa3)return blob;
 const segment=ebmlElement(bytes,first.end);if(segment?.id!==0x18538067)throw Error('WebM 文件头无效');let info=null,indexed=false,offset=segment.payload;
 while(offset<bytes.length){const e=ebmlElement(bytes,offset);if(!e)break;if(e.id===0x114d9b74)indexed=true;if(e.id===0x1549a966){info=e;break}if(e.end==null)break;offset=e.end}
 if(!info||info.end==null||info.end>bytes.length)throw Error('WebM 时长封装失败，请改用 MP4');
 let scale=1000000,existing=null;const fields=[];offset=info.payload;while(offset<info.end){const e=ebmlElement(bytes,offset);if(!e||e.end==null||e.end>info.end)throw Error('WebM Info 无效');if(e.id===0x2ad7b1){scale=0;for(const b of bytes.slice(e.payload,e.end))scale=scale*256+b}if(e.id===0x4489)existing=e;else fields.push(bytes.slice(e.start,e.end));offset=e.end}
 if(!scale)throw Error('WebM 时间单位无效');
 // Finalized native files already contain Duration and indexes. Update the float
 // in place so every SeekHead / Cues offset and the Segment size stay valid.
 if(existing&&[4,8].includes(existing.size)){const prefix=bytes.slice(0,info.end),view=new DataView(prefix.buffer);view[existing.size===8?'setFloat64':'setFloat32'](existing.payload,duration*1e9/scale,false);return new Blob([prefix,blob.slice(info.end)],{type:blob.type})}
 if(indexed||segment.size!==null)throw Error('此编码器生成的 WebM 索引不受支持，请改用 MP4');
 const field=new Uint8Array(11);field.set([0x44,0x89,0x88]);new DataView(field.buffer).setFloat64(3,duration*1e9/scale,false);fields.push(field);
 const length=fields.reduce((n,b)=>n+b.length,0),prefix=bytes.slice(0,info.start);prefix[segment.sizeStart]=(1<<(9-segment.sizeLength))-1;for(let i=1;i<segment.sizeLength;i++)prefix[segment.sizeStart+i]=255;
 return new Blob([prefix,bytes.slice(info.start,info.sizeStart),ebmlSize(length),...fields,blob.slice(info.end)],{type:blob.type});
}
export function compressionSink({mime,duration,writer=null,maxBytes=512*1048576,maxPending=32*1048576}){
 let queue=Promise.resolve(),closed=false,aborted=false,total=0,pending=0,first=true,chunks=[];
 return {
  get bytes(){return total},
  push(blob){if(closed)return Promise.reject(Error('压缩输出已关闭'));if(!blob.size)return Promise.resolve();pending+=blob.size;
   queue=queue.then(async()=>{if(aborted)return;if(pending>maxPending)throw Error('磁盘写入过慢，请降低清晰度后重试');let chunk=blob;if(first){first=false;if(mime.startsWith('video/webm'))chunk=await compressionChunk(blob,duration)}if(aborted)return;total+=chunk.size;if(!writer&&total>maxBytes)throw Error('压缩结果超过 512MB，请改为直接写入磁盘或选择更小档位');if(writer)await writer.write(chunk);else chunks.push(chunk)}).finally(()=>pending-=blob.size);queue.catch(()=>{});return queue;
  },
  async finish(){if(closed)throw Error('压缩输出已关闭');closed=true;await queue;if(aborted)throw Error('已取消压缩');if(!total)throw Error('编码器没有生成有效数据');if(writer){await writer.close();return null}const blob=new Blob(chunks,{type:mime});chunks=[];return blob},
  async abort(){aborted=true;closed=true;chunks=[];await queue.catch(()=>{});if(writer)await writer.abort().catch(()=>{})}
 };
}
