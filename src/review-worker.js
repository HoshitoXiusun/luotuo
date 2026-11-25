// This function is serialized into the offline page's local Blob worker.
function reviewWorkerMain(){
 const fingerprints=new Map(),previousBySource=new Map();
 let canvas,context;
 async function feature(blob,side){
  const bitmap=await createImageBitmap(blob);
  try{
   if(!canvas)canvas=new OffscreenCanvas(side,side);
   canvas.width=canvas.height=side;
   context=canvas.getContext('2d',{willReadFrequently:true});
   context.drawImage(bitmap,0,0,side,side);
   return context.getImageData(0,0,side,side).data;
  }finally{bitmap.close()}
 }
 self.onmessage=async event=>{
  const {shot,source}=event.data;
  try{
   const bytes=await shot.blob.arrayBuffer();
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
   const fingerprint=source+'|'+shot.width+'x'+shot.height+'|'+digest;
   const exact=fingerprints.get(fingerprint),previous=previousBySource.get(source);
   const current={id:shot.id,width:shot.width,height:shot.height,blob:shot.blob,pixels:await feature(shot.blob,REVIEW_SIDE)};
   let result=null,previousId;
   if(exact){result={type:'duplicate',exact:true};previousId=exact;}
   else if(previous&&previous.width===shot.width&&previous.height===shot.height){
    result=compareReviewFrames(previous.pixels,current.pixels);
    previousId=previous.id;
    if(result?.type==='duplicate'){
     const a=await feature(previous.blob,192),b=await feature(shot.blob,192);
     if(reviewLocalChange(a,b,192))result={type:'changed'};
    }
   }
   if(!fingerprints.has(fingerprint))fingerprints.set(fingerprint,shot.id);
   // Keep the prior distinct frame as the anchor through a run of repeats.
   if(result?.type!=='duplicate')previousBySource.set(source,current);
   self.postMessage({id:shot.id,previousId,result});
  }catch(error){self.postMessage({id:shot.id,error:error.message})}
 };
}

function createReviewWorker(){
 const source=[`const REVIEW_SIDE=${REVIEW_SIDE};`,reviewDifference,reviewLocalChange,compareReviewFrames,reviewWorkerMain]
  .map(piece=>typeof piece==='function'?piece.toString():piece).join('\n')+'\nreviewWorkerMain();';
 const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
 try{return new Worker(url)}finally{URL.revokeObjectURL(url)}
}
