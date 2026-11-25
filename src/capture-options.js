function currentCaptureOptions(){
 return {...captureOptions({captureFormat:$('captureFormat').value,captureQuality:Number($('captureQuality').value)/100,captureMaxEdge:Number($('captureMaxEdge').value)}),filenameTemplate:$('filenameTemplate').value};
}
function updateCaptureOptions(){
 const options=currentCaptureOptions();
 $('captureQuality').disabled=state.busy||options.captureFormat==='png';
 $('captureQualityValue').textContent=Math.round(options.captureQuality*100)+'%';
 $('captureQualityHint').textContent=options.captureFormat==='png'?'PNG 无损保存。质量设置用于后续截图。':'JPG 为有损压缩。调低质量可减小图库占用。';
 $('captureSummary').textContent=(options.captureMaxEdge?'最长边 '+options.captureMaxEdge+' px':'原分辨率')+' · '+options.captureFormat.toUpperCase();
 for(const id of ['captureFormat','captureMaxEdge','filenameTemplate','autoReview'])$(id).disabled=state.busy;
}
for(const id of ['captureFormat','captureQuality','captureMaxEdge','filenameTemplate'])$(id).oninput=()=>{try{updateCaptureOptions();markDirty()}catch(e){toast(e.message)}};
$('showCaptureOptions').onclick=()=>{$('advancedSettings').open=true;$('imageSettings').open=true;$('imageSettings').scrollIntoView({block:'center'});$('captureFormat').focus({preventScroll:true})};

function imageThumbnail(image,width,height,canvas=document.createElement('canvas')){
 const size=captureDimensions(width,height,256);
 if(canvas.width!==size.width)canvas.width=size.width;
 if(canvas.height!==size.height)canvas.height=size.height;
 canvas.getContext('2d').drawImage(image,0,0,size.width,size.height);
 return canvas.toDataURL('image/jpeg',.72);
}
function retainedImageBytes(){
 const shots=new Set(state.shots);
 for(const entry of state.undo)for(const shot of entry.shots||[])shots.add(shot);
 let total=0;
 for(const shot of shots)total+=shot.blob.size+2*(shot.thumbnail?.length||0);
 return total;
}
state.updateCaptureOptions=updateCaptureOptions;
