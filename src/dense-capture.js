const denseTrackCache = new WeakMap();
const denseCompatibility = new WeakMap();

async function prepareDenseCapture(file, times, width, height, cancelled) {
 if (!file || denseCompatibility.get(file)===false || typeof VideoDecoder==='undefined' || !/\.(mp4|m4v|mov)$/i.test(file.name) || times.length<3) return null;
 if (!times.some((t,i)=>i>=2 && t-times[i-2]<=2)) return null;
 try {
  let track=denseTrackCache.get(file);
  if (!track) {
   track=await readAvcTrack(file,cancelled);
   if (track) denseTrackCache.set(file,track);
  }
  if (!track || width!==track.width || height!==track.height || cancelled()) return null;
  const groups=planAvcGroups(track,times);
  if (!groups.size) return null;
  const config={codec:track.codec,description:track.description,codedWidth:width,codedHeight:height};
  if (!(await VideoDecoder.isConfigSupported(config)).supported) return null;
  return {track,groups,config};
 } catch {return null;}
}

async function decodeAvcGroup(file, track, config, group, signal) {
 const {offsets,sizes,ticks,timescale}=track, timestamp=i=>Math.round(ticks[i]*1e6/timescale);
 const wanted=new Set(group.targets.map(t=>timestamp(t.sample))), frames=new Map();
 let failure, completed=false, timer, stop;
 const decoder=new VideoDecoder({
  output(frame) {
   if (wanted.has(frame.timestamp) && !frames.has(frame.timestamp) && !signal.aborted) frames.set(frame.timestamp,frame);
   else frame.close();
  },
  error(error) {failure=error;}
 });
 try {
  decoder.configure(config);
  for(let i=group.start;i<=group.end;) {
   if (signal.aborted) return null;
   // Coalesce adjacent samples without reading unbounded gaps or an entire video.
   const first=i, base=offsets[i];
   let end=base+sizes[i++];
   while(i<=group.end && i-first<24 && offsets[i]>=end && offsets[i]+sizes[i]-base<=4*1024*1024) end=offsets[i]+sizes[i++];
   if (end-base>32*1024*1024) throw Error('单个视频样本超过快速处理范围');
   const bytes=await file.slice(base,end).arrayBuffer();
   if (signal.aborted) return null;
   if (failure) throw failure;
   for(let j=first;j<i;j++) decoder.decode(new EncodedVideoChunk({
    type:j===group.start?'key':'delta',timestamp:timestamp(j),
    data:new Uint8Array(bytes,offsets[j]-base,sizes[j])
   }));
  }
  await Promise.race([decoder.flush(),new Promise((resolve,reject)=>{
   stop=resolve;
   signal.addEventListener('abort',stop,{once:true});
   timer=setTimeout(()=>reject(Error('快速解码超时')),4000);
  })]);
  if (signal.aborted) return null;
  if (failure || frames.size!==wanted.size || [...frames.values()].some(frame=>frame.displayWidth!==track.width || frame.displayHeight!==track.height)) {
   throw Error('快速解码未取得完整画面');
  }
  completed=true;
  return {frames,timestamp};
 } finally {
  clearTimeout(timer);
  if(stop) signal.removeEventListener('abort',stop);
  if (decoder.state!=='closed') decoder.close();
  if (!completed) for(const frame of frames.values()) frame.close();
 }
}

async function verifyDenseFrames(group, decoded, width, height, cancelled) {
 const canvas=document.createElement('canvas');
 canvas.width=width;canvas.height=height;
 const context=canvas.getContext('2d');
 function pixels(source) {
  context.clearRect(0,0,width,height);
  context.drawImage(source,0,0);
  return new Uint32Array(context.getImageData(0,0,width,height).data.buffer);
 }
 try {
  for(const target of [group.targets[0],group.targets.at(-1)]) {
   if (cancelled()) return false;
   const fast=pixels(decoded.frames.get(decoded.timestamp(target.sample)));
   await seek(target.time);
   if (cancelled()) return false;
   const native=pixels(video);
   for(let i=0;i<fast.length;i++) if(fast[i]!==native[i]) return false;
  }
  return true;
 } finally {canvas.width=0;}
}

function batchSource(file, dense, cancelled, signal) {
 let current, available=new Map(), active, incompatible=false;
 function release() {
  if(active) for(const frame of active.frames.values()) frame.close();
  active=null;
  available.clear();
 }
 return {
  async prepare(time) {
   if (available.has(time)) {current=available.get(time);return;}
   release();
   current=null;
   const group=incompatible?null:dense?.groups.get(time);
   if(group) {
    try {
     active=await decodeAvcGroup(file,dense.track,dense.config,group,signal);
     if (active && !await verifyDenseFrames(group,active,dense.track.width,dense.track.height,cancelled)) {
      if(!cancelled()) denseCompatibility.set(file,false);
      incompatible=true;
      release();
     }
     if (active) {
      for(const target of group.targets) {
       const stamp=active.timestamp(target.sample);
       available.set(target.time,{frame:active.frames.get(stamp),presentationTime:dense.track.ticks[target.sample]/dense.track.timescale});
      }
      current=available.get(time);
     }
    } catch {incompatible=true;release();}
   }
   if(!current && !cancelled()) await seek(time);
  },
  encode(canvas,time) {
   return current?encodeShot(canvas,time,current):encodeShot(canvas,time);
  },
  close:release
 };
}
