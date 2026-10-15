// Keep the original media element as the sole decoder, audio source and capture
// source. Stable display replaces only the browser's visible native video layer.
const stableDisplay=(()=>{
 const screen=$('dropzone'),canvas=$('videoCanvas'),control=$('stablePlayback');
 const context=canvas.getContext('2d',{alpha:false});let active=false,chosen=false,layoutKey='',geometry=null;
 function paint(){
  if(!active||video.readyState<2||video.seeking||!video.videoWidth||!video.videoHeight)return false;
  const key=[screen.clientWidth,screen.clientHeight,window.devicePixelRatio||1,video.videoWidth,video.videoHeight].join('|');
  if(key!==layoutKey){
   geometry=displayGeometry(video.videoWidth,video.videoHeight,screen.clientWidth,screen.clientHeight,window.devicePixelRatio||1);
   if(!geometry)return false;
   if(canvas.width!==geometry.width)canvas.width=geometry.width;
   if(canvas.height!==geometry.height)canvas.height=geometry.height;
   context.fillStyle='#20242d';context.fillRect(0,0,canvas.width,canvas.height);
   context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';layoutKey=key;
  }
  // Do not clear the surface between frames. Black bars and pixel-aligned bounds
  // remain fixed, while each draw replaces only the image rectangle atomically.
  context.drawImage(video,geometry.x,geometry.y,geometry.drawWidth,geometry.drawHeight);return true;
 }
 function failed(){
  pump.stop();active=false;canvas.hidden=true;screen.classList.remove('use-stable-video');control.checked=false;
  toast('稳定显示暂不可用，已恢复原生画面；播放和截图仍可继续');
 }
 const pump=createFramePump(video,paint,{onError:failed});
 function apply(){
  pump.stop();active=control.checked&&!!video.getAttribute('src');layoutKey='';
  canvas.hidden=!active;screen.classList.toggle('use-stable-video',active);
  if(active){pump.paint();if(!video.paused)pump.start()}
 }
 function reset(){pump.stop();layoutKey='';geometry=null;context.fillStyle='#20242d';context.fillRect(0,0,canvas.width,canvas.height);control.disabled=true}
 control.onchange=()=>{chosen=true;apply()};canvas.onclick=togglePlay;
 video.addEventListener('emptied',reset);video.addEventListener('loadstart',reset);
 video.addEventListener('loadedmetadata',()=>{if(!chosen)control.checked=stableLivePreview||video.duration>=3600;apply()});
 video.addEventListener('loadeddata',()=>{control.disabled=false;apply()});
 video.addEventListener('play',()=>{if(active)pump.start()});
 video.addEventListener('pause',()=>{pump.stop();if(active)pump.paint()});
 video.addEventListener('seeking',()=>pump.stop());
 video.addEventListener('seeked',()=>{if(active){pump.paint();if(!video.paused)pump.start()}});
 video.addEventListener('ended',()=>{pump.stop();if(active)pump.paint()});video.addEventListener('error',()=>pump.stop());
 const resized=()=>{layoutKey='';if(active)pump.paint()};
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(resized).observe(screen);
 window.addEventListener('resize',resized);window.addEventListener('pagehide',()=>pump.stop());
 const resumed=()=>{if(active&&!document.hidden){pump.paint();if(!video.paused)pump.start()}};
 window.addEventListener('pageshow',resumed);window.addEventListener('focus',resumed);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pump.stop();else if(active){pump.paint();if(!video.paused)pump.start()}});
 return {refresh:apply};
})();
