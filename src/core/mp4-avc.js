// Read only the metadata and the byte ranges selected for decoding.
const MAX_MP4_SAMPLES = 2_000_000;
function mp4Unsupported() { throw Error('此 MP4 使用需要兼容定位的轨道结构'); }
const mp4Type = (view, offset) => String.fromCharCode(...new Uint8Array(view.buffer, offset, 4));

function mp4Header(view, offset, remaining) {
 const type = mp4Type(view, offset + 4);
 let size = view.getUint32(offset), header = 8;
 if (size === 1) {
  size = Number(view.getBigUint64(offset + 8));
  header = 16;
 } else if (!size) size = remaining;
 if (!Number.isSafeInteger(size) || size < header || size > remaining) mp4Unsupported();
 return {type, size, header};
}

function mp4Children(view, start, end) {
 const children = [];
 for (let cursor = start; cursor < end;) {
  if (end - cursor < 8) mp4Unsupported();
  const box = mp4Header(view, cursor, end - cursor);
  children.push({type:box.type, start:cursor + box.header, end:cursor + box.size});
  cursor += box.size;
 }
 return children;
}

export async function readAvcTrack(file, cancelled = () => false) {
 let metadata;
 const media=[];
 for (let offset = 0; offset < file.size;) {
  if (cancelled()) return null;
  const view = new DataView(await file.slice(offset, offset + 16).arrayBuffer());
  const box = mp4Header(view, 0, file.size - offset);
  if (box.type === 'moov') {
   if (metadata || box.size > 64 * 1024 * 1024) mp4Unsupported();
   metadata = new DataView(await file.slice(offset + box.header, offset + box.size).arrayBuffer());
  }
  if (box.type === 'mdat') media.push([offset + box.header, offset + box.size]);
  if (box.type === 'moof') mp4Unsupported();
  offset += box.size;
 }
 if (!metadata || !media.length || cancelled()) return null;
 const v = metadata;
 const kids = box => mp4Children(v, box.start, box.end);
 const pick = (list,type) => list.find(box => box.type === type);
 const need = (list,type) => pick(list,type) ?? mp4Unsupported();
 const root = mp4Children(v,0,v.byteLength);
 const tracks = root.filter(box => box.type === 'trak').map(kids);
 const videoTracks = tracks.filter(track => mp4Type(v, need(kids(need(track,'mdia')),'hdlr').start + 8) === 'vide');
 if (videoTracks.length !== 1 || pick(root,'mvex')) mp4Unsupported();
 const track = videoTracks[0], tkhd = need(track,'tkhd');
 const matrix = tkhd.start + (v.getUint8(tkhd.start) === 1 ? 52 : 40);
 if ([65536,0,0,0,65536,0,0,0,1073741824].some((n,i) => v.getInt32(matrix+i*4) !== n)) mp4Unsupported();
 const mdia = kids(need(track,'mdia')), mdhd = need(mdia,'mdhd');
 const timescale = v.getUint32(mdhd.start + (v.getUint8(mdhd.start) === 1 ? 20 : 12));
 if (!timescale) mp4Unsupported();
 let mediaStart = 0;
 const edts = pick(track,'edts');
 if (edts) {
  const edit = need(kids(edts),'elst'), p = edit.start, version = v.getUint8(p);
  if (version > 1 || v.getUint32(p+4) !== 1 || edit.end-p !== (version ? 28 : 20)) mp4Unsupported();
  mediaStart = version ? Number(v.getBigInt64(p+16)) : v.getInt32(p+12);
  if (!Number.isSafeInteger(mediaStart) || mediaStart < 0 || v.getUint32(p+(version ? 24 : 16)) !== 65536) mp4Unsupported();
 }
 const table = kids(need(kids(need(mdia,'minf')),'stbl'));
 const stsd = need(table,'stsd');
 const entries = mp4Children(v,stsd.start+8,stsd.end);
 if (entries.length !== 1 || entries[0].type !== 'avc1') mp4Unsupported();
 const entry = entries[0], width = v.getUint16(entry.start+24), height = v.getUint16(entry.start+26);
 if (!width || !height || width*height > 8_400_000) mp4Unsupported();
 const extensions = mp4Children(v,entry.start+78,entry.end);
 const colr=pick(extensions,'colr');
 if (colr) {
  const type=mp4Type(v,colr.start);
  const primaries=v.getUint16(colr.start+4), transfer=v.getUint16(colr.start+6), matrix=v.getUint16(colr.start+8);
  if (!['nclc','nclx'].includes(type) || ![1,2,5,6].includes(primaries) || ![1,2,6,13].includes(transfer) || ![1,2,5,6].includes(matrix)) mp4Unsupported();
 }
 const pasp = pick(extensions,'pasp');
 if (pasp && v.getUint32(pasp.start) !== v.getUint32(pasp.start+4)) mp4Unsupported();
 if (extensions.some(box => ['clap','irot','imir','dvcC','dvvC','mdcv','clli'].includes(box.type))) mp4Unsupported();
 const avc = need(extensions,'avcC');
 const description = new Uint8Array(v.buffer.slice(avc.start,avc.end));
 if (description.length < 7 || description[0] !== 1 || ![66,77,100].includes(description[1])) mp4Unsupported();
 const codec = 'avc1.' + Array.from(description.slice(1,4),n => n.toString(16).padStart(2,'0')).join('');
 const stsz = need(table,'stsz'), commonSize = v.getUint32(stsz.start+4), count = v.getUint32(stsz.start+8);
 if (!count || count > MAX_MP4_SAMPLES || stsz.end-stsz.start !== 12+(commonSize?0:count*4)) mp4Unsupported();
 const sizes = new Uint32Array(count), offsets = new Float64Array(count), ticks = new Float64Array(count);
 for (let i=0;i<count;i++) sizes[i] = commonSize || v.getUint32(stsz.start+12+i*4);
 const rows = (box,stride) => {
  const count = v.getUint32(box.start+4), start = box.start+8;
  if (box.end-start !== count*stride) mp4Unsupported();
  return {count, start};
 };
 function timing(box, composition) {
  const {count:length,start} = rows(box,8);
  let sample=0, dts=0;
  for (let row=0;row<length;row++) {
   const pos=start+row*8, run=v.getUint32(pos);
   const value=composition&&v.getUint8(box.start)===1?v.getInt32(pos+4):v.getUint32(pos+4);
   if (!run || run>count-sample || (!composition && !value)) mp4Unsupported();
   for (let i=0;i<run;i++,sample++) {
    if (composition) ticks[sample]+=value;
    else {ticks[sample]=dts-mediaStart;dts+=value;}
   }
  }
  if (sample!==count || !Number.isSafeInteger(dts)) mp4Unsupported();
 }
 timing(need(table,'stts'),false);
 const ctts=pick(table,'ctts');
 if (ctts) {if(v.getUint8(ctts.start)>1) mp4Unsupported();timing(ctts,true);}
 const chunks=pick(table,'co64') ?? need(table,'stco'), wide=chunks.type==='co64';
 const chunkRows=rows(chunks,wide?8:4), mapping=rows(need(table,'stsc'),12);
 let sample=0, row=-1, perChunk=0;
 for (let chunk=1;chunk<=chunkRows.count;chunk++) {
  const next=mapping.start+(row+1)*12;
  if (row+1<mapping.count && v.getUint32(next)===chunk) {
   row++;
   perChunk=v.getUint32(next+4);
   if (v.getUint32(next+8)!==1) mp4Unsupported();
  }
  if (!perChunk || perChunk>count-sample) mp4Unsupported();
  const p=chunkRows.start+(chunk-1)*(wide?8:4);
  const offset=wide?Number(v.getBigUint64(p)):v.getUint32(p);
  let cursor=offset;
  for (let i=0;i<perChunk;i++,sample++) {
   offsets[sample]=cursor;
   if (!sizes[sample]) mp4Unsupported();
   cursor+=sizes[sample];
  }
  if (!media.some(([start,end])=>offset>=start && cursor<=end)) mp4Unsupported();
 }
 if (sample!==count || row!==mapping.count-1) mp4Unsupported();
 const stss=pick(table,'stss'), keys=[];
 if (stss) {
  const {count:length,start}=rows(stss,4);
  for(let i=0;i<length;i++) {
   const key=v.getUint32(start+i*4)-1;
   if (key<0 || key>=count || (i && key<=keys[i-1])) mp4Unsupported();
   keys.push(key);
  }
 } else return null; // All-intra sources have no inter-frame decode work to share.
 if (keys[0]!==0) mp4Unsupported();
 const presentation=Uint32Array.from({length:count},(_,i)=>i);
 if (ctts) presentation.sort((a,b)=>ticks[a]-ticks[b]||a-b);
 return {width,height,codec,description,timescale,ticks,presentation,keys,offsets,sizes};
}

export function planAvcGroups(track,times) {
 const {presentation,ticks,timescale,keys}=track;
 function atOrBefore(length,test) {
  let low=0, high=length;
  while(low<high) {
   const middle=Math.floor((low+high)/2);
   if(test(middle)) low=middle+1;else high=middle;
  }
  return low-1;
 }
 const groups=new Map();
 for (const time of times) {
  const tick=time*timescale;
  const p=atOrBefore(presentation.length,i=>ticks[presentation[i]]<=tick+1e-7);
  if (p<0 || (p>0 && ticks[presentation[p-1]]===ticks[presentation[p]])) continue;
  const sample=presentation[p], key=atOrBefore(keys.length,i=>keys[i]<=sample);
  if (key<0) continue;
  if (!groups.has(key)) groups.set(key,[]);
  groups.get(key).push({time,sample});
 }
 const eligible=new Map();
 for (const [key,targets] of groups) {
  const start=keys[key], end=Math.max(...targets.map(t=>t.sample));
  const next=keys[key+1]??ticks.length;
  // Reject open/reordered GOPs whose display intervals cross keyframe boundaries.
  if (targets.length<3 || end-start>240 || next-start>480 || ticks[start]<0) continue;
  let closed=true;
  for(let i=start;i<next;i++) if(ticks[i]<ticks[start] || (next<ticks.length && ticks[i]>=ticks[next])) {closed=false;break;}
   if (!closed || (next<ticks.length&&targets.some(target=>target.time*timescale>=ticks[next]))) continue;
  const maxFrames=Math.max(3,Math.floor(80*1024*1024/(track.width*track.height*4)));
  const firstIndex=times.indexOf(targets[0].time);
  if (!targets.every((target,i)=>times[firstIndex+i]===target.time)) continue;
  for (let i=0;i<targets.length;i+=maxFrames) {
   const subset=targets.slice(i,i+maxFrames);
   const end=Math.max(...subset.map(t=>t.sample));
   const decodeCount=end-start+1;
   const separateCost=subset.reduce((sum,target)=>sum+target.sample-start+1,0);
   // A fresh decoder costs time. Prefer the resident player for short GOP prefixes
   // and only switch when a group reuses substantial decode work.
   if (subset.length>=3 && decodeCount>=60 && separateCost>=decodeCount*3) {
    eligible.set(subset[0].time,{start,end,targets:subset});
   }
  }
 }
 return eligible;
}

