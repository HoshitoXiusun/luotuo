// The track and thumb use the same 14px size in CSS and this coordinate mapping.
export function hoverTimeAt(clientX,rect,duration){
 if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(clientX)||!Number.isFinite(rect.width)||rect.width<=0)return null;
 const inset=Math.min(7,rect.width/2),width=Math.max(1,rect.width-2*inset);
 return Math.max(0,Math.min(1,(clientX-rect.left-inset)/width))*duration;
}
export function previewPosition(clientX,rect,width,height,viewportWidth,viewportHeight){
 const gap=12,clamp=(n,low,high)=>Math.max(low,Math.min(Math.max(low,high),n));
 const top=rect.top-height-gap>=gap?rect.top-height-gap:rect.bottom+gap;
 return {left:clamp(clientX-width/2,gap,viewportWidth-width-gap),top:clamp(top,gap,viewportHeight-height-gap)};
}
// One seek at a time, one pending target, no growing queue. Only the latest
// pending target survives. Frames carry their actual target and latest flag;
// cancel prevents any old-source result and aborts decoder event waits.
export function createPreviewQueue(render,commit,onError,delay=60){
 let pending=null,timer=null,active=null,sequence=0,generation=0;
 const schedule=()=>{if(!active&&pending&&timer===null)timer=setTimeout(run,delay)};
 async function run(){
  timer=null;if(active||!pending)return;
  const job={...pending,generation};pending=null;const controller=new AbortController();active=controller;
  try{const frame=await render(job.target,controller.signal);if(!controller.signal.aborted&&job.generation===generation)commit(frame,job.target,{latest:job.sequence===sequence})}
  catch(error){if(!controller.signal.aborted&&job.sequence===sequence)onError(error)}
  finally{if(active===controller)active=null;schedule()}
 }
 return {
  request(target){pending={target,sequence:++sequence};schedule()},
  cancel(){sequence++;generation++;pending=null;if(timer!==null){clearTimeout(timer);timer=null}active?.abort()}
 };
}
