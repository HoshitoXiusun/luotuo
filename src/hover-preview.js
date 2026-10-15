// Independent, muted, paused decoder. Hovering never seeks or plays `video`.
const timelineHover=(()=>{
 const track=$('timeline'),tip=$('timelinePreview'),canvas=$('timelinePreviewCanvas');
 const label=$('timelinePreviewTime'),status=$('timelinePreviewStatus');
 let decoder=null,sourceURL=null,idleTimer=null,lastTarget=null,visible=false;
 function releaseDecoder(){
  if(!decoder)return;
  decoder.pause();decoder.removeAttribute('src');decoder.load();decoder.remove();decoder=null;sourceURL=null;
 }
 function waitMedia(media,predicate,signal,start){
  return new Promise((resolve,reject)=>{
   let settled=false,timer;
   const events=['loadedmetadata','loadeddata','seeked','canplay'];
   const done=error=>{if(settled)return;settled=true;clearTimeout(timer);events.forEach(e=>media.removeEventListener(e,check));media.removeEventListener('error',failed);signal.removeEventListener('abort',aborted);error?reject(error):resolve()};
   const check=()=>{if(predicate())done()},failed=()=>done(Error('此处暂无法预览')),aborted=()=>done(Error('预览已取消'));
   if(signal.aborted){aborted();return}
   events.forEach(e=>media.addEventListener(e,check));media.addEventListener('error',failed);signal.addEventListener('abort',aborted,{once:true});
   timer=setTimeout(()=>done(Error('预览定位较慢，请移动鼠标重试')),12000);
   try{start?.();check()}catch(error){done(error)}
  });
 }
 async function render(target,signal){
  if(!state.ready||!state.url)throw Error('请先选择视频');
  const url=state.url;
  if(decoder?.error)releaseDecoder();
  if(!decoder||sourceURL!==url){
   releaseDecoder();decoder=document.createElement('video');sourceURL=url;
   decoder.className='timeline-preview-decoder';decoder.preload='metadata';decoder.muted=true;decoder.defaultMuted=true;decoder.volume=0;decoder.playsInline=true;decoder.tabIndex=-1;decoder.disablePictureInPicture=true;decoder.setAttribute('aria-hidden','true');document.body.append(decoder);
  }
  const media=decoder;
  await waitMedia(media,()=>media.readyState>=1&&Number.isFinite(media.duration),signal,()=>{if(!media.getAttribute('src')){media.src=url;media.load()}});
  await waitMedia(media,()=>!media.seeking&&media.readyState>=2&&Math.abs(media.currentTime-target)<.015,signal,()=>{if(Math.abs(media.currentTime-target)>.00001||media.readyState<2)media.currentTime=target});
  if(signal.aborted||sourceURL!==url)throw Error('预览已取消');
  // A small fixed canvas bounds preview memory even for a 4K source. Original
  // resolution capture still draws from the main video via takeShot().
  const frame=document.createElement('canvas');frame.width=384;frame.height=216;
  const context=frame.getContext('2d');context.fillStyle='#20242d';context.fillRect(0,0,frame.width,frame.height);
  const scale=Math.min(frame.width/media.videoWidth,frame.height/media.videoHeight),w=media.videoWidth*scale,h=media.videoHeight*scale;
  context.drawImage(media,(frame.width-w)/2,(frame.height-h)/2,w,h);
  return {canvas:frame,time:media.currentTime};
 }
 const queue=createPreviewQueue(render,(frame,target,{latest})=>{
  if(!visible)return;
  canvas.getContext('2d').drawImage(frame.canvas,0,0);canvas.hidden=false;
  label.textContent=timeText(frame.time);tip.dataset.time=String(frame.time);tip.classList.add('has-frame');status.hidden=latest;
 },error=>{if(!visible)return;lastTarget=null;canvas.hidden=true;tip.classList.remove('has-frame');status.textContent=error.message;status.hidden=false;releaseDecoder()});
 function hide(){
  visible=false;lastTarget=null;tip.hidden=true;tip.removeAttribute('data-time');queue.cancel();
  clearTimeout(idleTimer);idleTimer=setTimeout(releaseDecoder,8000);
 }
 function reset(){hide();clearTimeout(idleTimer);releaseDecoder();canvas.hidden=true;tip.classList.remove('has-frame')}
 function show(event){
  if(event.pointerType==='touch'||track.disabled||!state.ready||!state.url||state.busy)return hide();
  const rect=track.getBoundingClientRect(),raw=hoverTimeAt(event.clientX,rect,video.duration);
  if(raw===null)return hide();
  const target=Math.min(Math.max(0,video.duration-.000001),Math.round(raw*10)/10);
  clearTimeout(idleTimer);visible=true;tip.hidden=false;
  const point=previewPosition(event.clientX,rect,tip.offsetWidth,tip.offsetHeight,document.documentElement.clientWidth,window.innerHeight);
  tip.style.left=point.left+'px';tip.style.top=point.top+'px';
  if(lastTarget===target)return;
  lastTarget=target;tip.removeAttribute('data-time');if(canvas.hidden)label.textContent=timeText(target);status.hidden=false;status.textContent='正在定位…';queue.request(target);
 }
 track.addEventListener('pointerenter',show);track.addEventListener('pointermove',show);
 track.addEventListener('pointerleave',hide);track.addEventListener('pointercancel',hide);track.addEventListener('blur',hide);
 // Scrolling, dialogs, changing files and restoring a project must not leave a
 // floating image attached to the old track or the old source.
 video.addEventListener('emptied',reset);video.addEventListener('loadstart',reset);
 window.addEventListener('scroll',hide,{passive:true,capture:true});window.addEventListener('resize',hide);window.addEventListener('blur',hide);window.addEventListener('pagehide',reset);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)reset()});document.addEventListener('keydown',e=>{if(e.key==='Escape')hide()});
 state.hideTimelinePreview=hide;
 return {reset};
})();
