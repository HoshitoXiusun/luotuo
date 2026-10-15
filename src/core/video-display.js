export function displayGeometry(videoWidth,videoHeight,boxWidth,boxHeight,pixelRatio=1){
 if(![videoWidth,videoHeight,boxWidth,boxHeight,pixelRatio].every(n=>Number.isFinite(n)&&n>0))return null;
 const ratio=Math.min(pixelRatio,1920/boxWidth,1200/boxHeight,Math.sqrt(2100000/(boxWidth*boxHeight)));
 const width=Math.max(1,Math.round(boxWidth*ratio)),height=Math.max(1,Math.round(boxHeight*ratio));
 const scale=Math.min(width/videoWidth,height/videoHeight),drawWidth=Math.max(1,Math.min(width,Math.round(videoWidth*scale))),drawHeight=Math.max(1,Math.min(height,Math.round(videoHeight*scale)));
 return {width,height,x:Math.round((width-drawWidth)/2),y:Math.round((height-drawHeight)/2),drawWidth,drawHeight};
}
// One presentation loop. Decoded-frame callbacks pace normal playback; a bounded
// fallback keeps painting when a browser suppresses callbacks for a hidden layer.
// No play/pause/seek/audio operation belongs in this display-only component.
export function createFramePump(media,draw,{raf=requestAnimationFrame,caf=cancelAnimationFrame,now=()=>performance.now(),onError=()=>{}}={}){
 let generation=0,running=false,animationId=null,videoId=null,lastCallback=0,lastFallback=0,lastFrameTime=-Infinity,lastDrawTime=NaN;
 const ready=()=>media.readyState>=2&&!media.seeking&&media.videoWidth>0&&media.videoHeight>0;
 function paint(time){if(!ready())return false;try{if(draw(time)!==false){lastDrawTime=media.currentTime;return true}}catch(error){onError(error)}return false}
 function stop(){running=false;generation++;if(animationId!==null)caf(animationId);if(videoId!==null)media.cancelVideoFrameCallback?.(videoId);animationId=null;videoId=null}
 function start(){
  stop();if(media.paused||media.ended)return;
  running=true;const token=generation;lastFrameTime=-Infinity;lastCallback=now();lastFallback=0;paint(media.currentTime);if(!running||token!==generation)return;
  const videoFrame=(_,metadata)=>{
   if(!running||token!==generation)return;
   videoId=null;lastCallback=now();const time=metadata?.mediaTime??media.currentTime;
   if(time>=lastFrameTime&&ready()){if(paint(time))lastFrameTime=time}
   if(running&&token===generation)videoId=media.requestVideoFrameCallback(videoFrame);
  };
  if(media.requestVideoFrameCallback)videoId=media.requestVideoFrameCallback(videoFrame);
  const tick=()=>{
   if(!running||token!==generation)return;
   const time=now();
   if((!media.requestVideoFrameCallback||time-lastCallback>250)&&time-lastFallback>=33&&media.currentTime!==lastDrawTime){paint(media.currentTime);lastFallback=time}
   if(running&&token===generation)animationId=raf(tick);
  };
  animationId=raf(tick);
 }
 return {start,stop,paint:()=>paint(media.currentTime)};
}
