const galleryThumbnailQueue=[];
let galleryThumbnailActive=false,galleryThumbnailWorker=null,galleryThumbnailWorkerFailed=false;

function thumbnailWorkerMain(){
 self.onmessage=async({data})=>{
  let bitmap;
  try{
   bitmap=await createImageBitmap(data.blob,{resizeWidth:data.width,resizeHeight:data.height});
   const canvas=new OffscreenCanvas(data.width,data.height);
   canvas.getContext('2d').drawImage(bitmap,0,0,data.width,data.height);
   const blob=await canvas.convertToBlob({type:'image/jpeg',quality:.72});
   self.postMessage({thumbnail:new FileReaderSync().readAsDataURL(blob)});
  }catch(error){self.postMessage({error:error.message})}
  finally{bitmap?.close()}
 };
}

async function makeGalleryThumbnail(shot){
 const {width,height}=captureDimensions(shot.width,shot.height,256);
 if(!galleryThumbnailWorkerFailed){
  try{
   if(!galleryThumbnailWorker){
    const url=URL.createObjectURL(new Blob(['('+thumbnailWorkerMain.toString()+')()'],{type:'text/javascript'}));
    try{galleryThumbnailWorker=new Worker(url)}finally{URL.revokeObjectURL(url)}
   }
   const result=await new Promise((resolve,reject)=>{
    galleryThumbnailWorker.onmessage=event=>resolve(event.data);
    galleryThumbnailWorker.onerror=()=>reject(Error('缩略图后台处理不可用'));
    galleryThumbnailWorker.postMessage({blob:shot.blob,width,height});
   });
   if(!result.thumbnail)throw Error(result.error);
   return result.thumbnail;
  }catch{
   galleryThumbnailWorker?.terminate();galleryThumbnailWorker=null;galleryThumbnailWorkerFailed=true;
  }
 }
 const bitmap=await createImageBitmap(shot.blob,{resizeWidth:width,resizeHeight:height});
 try{return imageThumbnail(bitmap,width,height)}finally{bitmap.close()}
}

async function pumpGalleryThumbnails(){
 if(galleryThumbnailActive)return;
 galleryThumbnailActive=true;
 try{
  while(galleryThumbnailQueue.length){
   const {shot,image}=galleryThumbnailQueue.shift();
   if(!image.isConnected)continue;
   try{
    if(!shot.thumbnail){
     const thumbnail=await makeGalleryThumbnail(shot);
     if(retainedImageBytes()+thumbnail.length*2<=GALLERY_BYTE_LIMIT)shot.thumbnail=thumbnail;
    }
    if(image.isConnected)image.src=shot.thumbnail||shot.url;
   }catch{if(image.isConnected)image.src=shot.url;}
  }
 }finally{galleryThumbnailActive=false;}
}

function queueGalleryThumbnail(shot,image){
 if(shot.thumbnail){image.src=shot.thumbnail;return}
 galleryThumbnailQueue.push({shot,image});
 setTimeout(pumpGalleryThumbnails,0);
}
