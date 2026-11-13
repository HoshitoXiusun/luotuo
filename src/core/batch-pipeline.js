// A single decoder seeks in order. Each encoder owns its slot until it
// settles; the queue commits in capture order, not callback order.
export async function runBatchPipeline(times,{seekTo,encode,commit,cancelled=()=>false}){
 const free=[1,0],pending=[];let captureError=null;
 async function consume(){
  const {slot,result}=pending.shift(),out=await result;
  free.push(slot);
  if(!out.ok)throw out.error;
  commit(out.value);
 }
 try{
  for(const time of times){
   if(cancelled())break;
   try{
    await seekTo(time);
    if(cancelled())break;
    const slot=free.pop();
    const result=Promise.resolve(encode(time,slot)).then(value=>({ok:true,value}),error=>({ok:false,error}));
    pending.push({slot,result});
   }catch(error){captureError={error};break}
   if(!free.length)await consume();
  }
  // Keep frames already drawn when cancellation or a later seek stops input.
  while(pending.length)await consume();
  if(captureError)throw captureError.error;
 }finally{
  // Even on encoding failure, do not release canvases still being read.
  await Promise.all(pending.map(job=>job.result));
 }
}
