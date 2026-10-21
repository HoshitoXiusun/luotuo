const compression={file:null,info:null,url:null,result:null,resultURL:null,probe:null,seq:0,job:null};
function compressionSize(bytes){return bytes>=1048576?(bytes/1048576).toFixed(1)+' MB':(bytes/1024).toFixed(1)+' KB'}
function compressionSupported(){return typeof MediaRecorder!=='undefined'&&typeof HTMLCanvasElement.prototype.captureStream==='function'}
function clearCompressionResult(){if(compression.resultURL)URL.revokeObjectURL(compression.resultURL);compression.resultURL=null;compression.result=null;$('compressResultVideo').pause();$('compressResultVideo').removeAttribute('src');$('compressResultVideo').load();$('compressResult').hidden=true}
function compressionSettings(){return {resolution:Number($('compressResolution').value),quality:$('compressQuality').value,fps:Number($('compressFPS').value),audio:$('compressAudio').checked}}
function updateCompressionControls(){
 const running=!!compression.job,ready=!!compression.info;for(const id of ['compressPick','compressInput','compressResolution','compressQuality','compressFPS','compressAudio','compressFormat','compressSaveMode'])$(id).disabled=state.busy;
 $('compressCurrent').disabled=state.busy||!state.sourceFile;$('compressStart').disabled=state.busy||!ready||!compressionSupported();$('compressCancel').hidden=!running;$('compressPause').hidden=!running||!compression.job?.recorder;
 $('compressDownload').disabled=running||!compression.result;
 if(!running){$('compressProgress').hidden=true;$('compressPause').textContent='暂停';try{if(ready){const plan=compressionPlan({...compression.info,...compressionSettings()}),format=compressionFormat($('compressFormat').value,plan.audio,t=>MediaRecorder.isTypeSupported(t));$('compressEstimate').textContent=`${plan.width} × ${plan.height} · ${plan.fps} FPS · ${format.extension.toUpperCase()} · 预估 ${compressionSize(plan.estimatedBytes)}`;$('compressStart').disabled=state.busy;$('compressStart').title=''}else $('compressEstimate').textContent='选择视频后显示预估体积'}catch(e){$('compressEstimate').textContent=e.message;$('compressStart').disabled=true}}
}
function waitCompressionMedia(media,event,signal){return new Promise((resolve,reject)=>{
 const done=error=>{clearTimeout(timer);media.removeEventListener(event,ok);media.removeEventListener('error',bad);signal?.removeEventListener('abort',cancel);error?reject(error):resolve()};
 const ok=()=>done(),bad=()=>done(Error('浏览器无法解码此视频，请使用可播放的 MP4 / WebM')),cancel=()=>done(Error('已取消压缩'));const timer=setTimeout(()=>done(Error('视频读取超时，请重新选择文件')),90000);
 media.addEventListener(event,ok,{once:true});media.addEventListener('error',bad,{once:true});signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
})}
async function selectCompressionFile(file){
 if(!file||state.busy)return;const seq=++compression.seq;compression.probe?.abort();const controller=new AbortController();compression.probe=controller;clearCompressionResult();compression.info=null;compression.file=null;if(compression.url)URL.revokeObjectURL(compression.url);compression.url=URL.createObjectURL(file);const sourceURL=compression.url,probe=document.createElement('video');probe.preload='metadata';probe.muted=true;$('compressSource').textContent='正在读取视频信息…';$('compressStatus').textContent='';updateCompressionControls();
 try{const ready=waitCompressionMedia(probe,'loadedmetadata',controller.signal);probe.src=sourceURL;probe.load();await ready;if(seq!==compression.seq)return;const info={width:probe.videoWidth,height:probe.videoHeight,duration:probe.duration,size:file.size};compressionPlan({...info,...compressionSettings()});compression.file=file;compression.info=info;$('compressSource').textContent=`${file.name} · ${timeText(info.duration)} · ${compressionSize(file.size)}`;$('compressSource').title=file.name;$('compressStatus').textContent='准备就绪'}catch(e){if(seq===compression.seq){$('compressSource').textContent='未读取到有效视频';$('compressStatus').textContent=e.message}}finally{probe.removeAttribute('src');probe.load();if(seq===compression.seq){compression.probe=null;updateCompressionControls()}}
}
async function startCompression(){
 if(state.busy||!compression.file||!compression.info)return;let plan,format;try{if(!compressionSupported())throw Error('此浏览器不支持本地视频压缩');plan=compressionPlan({...compression.info,...compressionSettings()});format=compressionFormat($('compressFormat').value,plan.audio,t=>MediaRecorder.isTypeSupported(t));if($('compressSaveMode').value==='download'&&plan.estimatedBytes>512*1048576)throw Error('预计输出超过 512MB，请降低档位或使用直接写入磁盘')}catch(e){toast(e.message);return}
 clearCompressionResult();const file=compression.file,sourceURL=compression.url,wasPlaying=!video.paused,mainURL=state.url,controller=new AbortController(),job={controller,recorder:null,cancelled:false,manual:false,hidden:document.hidden};compression.job=job;state.busy=true;updateControls();$('compressStatus').textContent='正在准备本地编码…';$('compressProgress').hidden=false;$('compressProgress').value=0;
 let context=null,node=null,destination=null,source=null,stream=null,pump=null,sink=null,handle=null,timer=null,success=false;
 try{
  const name=safeName(file.name.replace(/\.[^.]+$/,''))+'_压缩.'+format.extension;
  if($('compressSaveMode').value==='disk'){
   if(!window.showSaveFilePicker)throw Error('当前浏览器不支持直接写入磁盘，请使用 Chrome / Edge');
   handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:'压缩视频',accept:{[format.mime.split(';')[0]]:['.'+format.extension]}}]});
   if(controller.signal.aborted)throw Error('已取消压缩');
   if(handle.name===file.name)throw Error('请选择不同于原视频的文件名，避免覆盖源文件');
  }
  if(plan.audio){const AudioCtor=window.AudioContext||window.webkitAudioContext;if(!AudioCtor)throw Error('此浏览器不能保留声音，请更换浏览器或取消保留声音');context=new AudioCtor();await context.resume()}
  if(controller.signal.aborted)throw Error('已取消压缩');video.pause();$('compressStage').hidden=false;source=document.createElement('video');source.playsInline=true;source.preload='auto';source.muted=!plan.audio;source.volume=1;source.className='compression-source';$('compressStage').append(source);
  const ready=waitCompressionMedia(source,'loadeddata',controller.signal);source.src=sourceURL;source.load();await ready;source.playbackRate=1;
  const canvas=$('compressCanvas');canvas.width=plan.width;canvas.height=plan.height;$('compressStage').style.aspectRatio=plan.width+'/'+plan.height;const ctx=canvas.getContext('2d',{alpha:false});ctx.drawImage(source,0,0,plan.width,plan.height);stream=canvas.captureStream(plan.fps);
  if(plan.audio){node=context.createMediaElementSource(source);destination=context.createMediaStreamDestination();node.connect(destination);for(const track of destination.stream.getAudioTracks())stream.addTrack(track)}
  const options={mimeType:format.mime,videoBitsPerSecond:plan.videoBitsPerSecond};if(plan.audio)options.audioBitsPerSecond=plan.audioBitsPerSecond;
  const recorder=new MediaRecorder(stream,options);job.recorder=recorder;const writer=handle?await handle.createWritable():null;sink=compressionSink({mime:recorder.mimeType||format.mime,duration:plan.duration,writer});
  await new Promise((resolve,reject)=>{
   let stopping=false,failed=null,started=false,stopTimer=null,lastTime=0,lastAdvance=performance.now();
   const finish=error=>{if(stopping)return;stopping=true;failed=error||null;pump?.stop();source.pause();if(recorder.state!=='inactive'){recorder.stop();stopTimer=setTimeout(()=>reject(error||Error('视频封装超时，请重试')),5000)}else error?reject(error):resolve()};
   const paused=()=>job.manual||job.hidden;
   const applyPause=()=>{if(stopping||!started)return;if(paused()){if(recorder.state==='recording')recorder.pause();source.pause();pump.stop();$('compressStatus').textContent=job.hidden?'页面在后台，压缩已暂停；返回后继续':'压缩已暂停';$('compressPause').textContent='继续'}else{$('compressPause').textContent='暂停';context?.resume().catch(finish);source.play().then(()=>{if(!stopping&&!paused()){if(recorder.state==='paused')recorder.resume();pump.start();$('compressStatus').textContent='正在本地压缩…'}}).catch(finish)}};
   job.setPaused=applyPause;controller.signal.addEventListener('abort',()=>finish(Error('已取消压缩')),{once:true});
   recorder.ondataavailable=e=>{if(e.data.size)sink.push(e.data).catch(finish)};recorder.onerror=e=>finish(e.error||Error('浏览器编码失败，请降低清晰度后重试'));recorder.onstop=()=>{clearTimeout(stopTimer);failed?reject(failed):resolve()};
   source.onended=()=>{pump.paint();finish()};source.onerror=()=>finish(Error('视频解码中断'));source.onwaiting=()=>{if(!stopping&&recorder.state==='recording'){recorder.pause();pump.stop();$('compressStatus').textContent='正在等待本地视频数据…'}};source.onplaying=()=>{if(stopping)return;if(paused()){applyPause();return}if(recorder.state==='paused')recorder.resume();pump.start()};
   pump=createFramePump(source,()=>{ctx.drawImage(source,0,0,plan.width,plan.height);return true},{onError:finish});
   timer=setInterval(()=>{if(stopping)return;const time=source.currentTime;if(time>lastTime+.01){lastTime=time;lastAdvance=performance.now()}else if(!paused()&&performance.now()-lastAdvance>45000)finish(Error('视频长时间未推进，请降低清晰度后重试'));if(paused()){lastAdvance=performance.now();return}$('compressProgress').value=Math.min(99,time/plan.duration*100);$('compressStatus').textContent=`正在本地压缩 ${Math.min(99,Math.floor(time/plan.duration*100))}% · 剩余约 ${timeText(Math.max(0,plan.duration-time)).slice(0,8)} · 已生成 ${compressionSize(sink.bytes)}`},400);
   if(controller.signal.aborted){finish(Error('已取消压缩'));return}// Video-only encoders can accept the first still frame before playback.
   // Audio encoders need the decoder running to supply their first audio data.
   recorder.onstart=()=>{started=true;applyPause()};recorder.start(1000);ctx.drawImage(source,0,0,plan.width,plan.height);if(plan.audio){started=true;applyPause()}updateCompressionControls();
  });
  if(controller.signal.aborted)throw Error('已取消压缩');$('compressStatus').textContent='正在封装视频文件…';const blob=await sink.finish();const result=handle?await handle.getFile():blob;success=true;compression.result={blob:result,name,width:plan.width,height:plan.height,sourceBytes:file.size,format:format.extension};compression.resultURL=URL.createObjectURL(result);$('compressResultVideo').src=compression.resultURL;$('compressResult').hidden=false;const delta=1-result.size/file.size;
  $('compressResultInfo').textContent=`${compressionSize(file.size)} → ${compressionSize(result.size)} · ${delta>=0?'减少 '+(delta*100).toFixed(1)+'%':'结果增大 '+(-delta*100).toFixed(1)+'%，可降低档位重试'} · ${plan.width} × ${plan.height}`;$('compressStatus').textContent=handle?'压缩完成，文件已保存到所选位置':'压缩完成，请下载结果';$('compressProgress').value=100;
 }catch(e){$('compressStatus').textContent=controller.signal.aborted||e.name==='AbortError'?'已取消，未保留压缩结果':e.message;if(!controller.signal.aborted&&e.name!=='AbortError')toast('压缩未完成：'+e.message)}finally{
  clearInterval(timer);pump?.stop();if(!success)await sink?.abort();if(source){source.pause();source.removeAttribute('src');source.load();source.remove()}for(const track of stream?.getTracks()||[])track.stop();node?.disconnect();if(context)await context.close().catch(()=>{});compression.job=null;state.busy=false;$('compressStage').hidden=true;updateControls();
  if(wasPlaying&&state.ready&&state.url===mainURL){try{await video.play()}catch{toast('压缩已结束，请点击播放器继续播放')}}
 }
}
$('compressPick').onclick=()=>$('compressInput').click();$('compressInput').onchange=e=>{selectCompressionFile(e.target.files[0]);e.target.value=''};$('compressCurrent').onclick=()=>selectCompressionFile(state.sourceFile);$('compressStart').onclick=startCompression;
$('compressCancel').onclick=()=>{compression.job?.controller.abort();$('compressStatus').textContent='正在取消压缩…'};$('compressPause').onclick=()=>{const job=compression.job;if(job){job.manual=!job.manual;job.setPaused?.()}};
$('compressDownload').onclick=async()=>{try{if(compression.result&&!compression.job)await save(compression.result.blob,compression.result.name)}catch(e){toast('保存失败：'+e.message)}};
for(const id of ['compressResolution','compressQuality','compressFPS','compressAudio','compressFormat','compressSaveMode'])$(id).onchange=updateCompressionControls;
if(!window.showSaveFilePicker)$('compressSaveMode').querySelector('[value="disk"]').disabled=true;
document.addEventListener('visibilitychange',()=>{const job=compression.job;if(job){job.hidden=document.hidden;job.setPaused?.()}});window.addEventListener('pagehide',()=>compression.job?.controller.abort());
state.updateCompressionControls=updateCompressionControls;state.onCompressionMode=()=>{if(!compression.file&&state.sourceFile&&!state.busy)selectCompressionFile(state.sourceFile)};
