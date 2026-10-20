export function defaultPageBox(width,height){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('截图尺寸无效');
 // WPS footer preview: the 1.27cm margin guide is ABOVE the page-number
 // text. Align the box's top to that guide and extend it into the footer,
 // instead of placing its bottom there. Use the export page's physical scale.
 const boxHeight=Math.max(.001,Math.min(.25,.026*width/height));
 const pageHeight=595.28*height/width,footerGuide=1.27*72/2.54;
 return {width:.145,height:boxHeight,bottom:Math.max(0,Math.min(.4,footerGuide/pageHeight-boxHeight)),align:'center'};
}
// Relative to the screenshot, never to the preview's letterbox padding.
export function normalizePageBox(value){
 if(value==null)return null;
 if(typeof value!=='object'||Array.isArray(value))throw Error('页码白框设置无效');
 const {width,height,bottom,align}=value;
 if(!['left','center','right'].includes(align))throw Error('页码白框位置无效');
 for(const [v,min,max] of [[width,.03,.8],[height,.001,.25],[bottom,0,.4]])if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('页码白框尺寸超出范围');
 return {width,height,bottom,align};
}
export function pageBoxRect(value,width,height){
 const b=normalizePageBox(value);if(!b)return null;
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('截图尺寸无效');
 const margin=Math.min(.02,(1-b.width)/2),x=b.align==='center'?(1-b.width)/2:b.align==='left'?margin:1-margin-b.width;
 return {x:x*width,y:(1-b.bottom-b.height)*height,width:b.width*width,height:b.height*height};
}
// One PNG Image XObject per page; each white box is a different Form XObject
// with its own OCG. No annotation above subsequent page-number content, no
// flattening or modification of the PNG's pixels.
export async function createLayeredPDF(shots,{library,renderImage,onProgress=()=>{}}){
 if(!shots.length)throw Error('没有可导出的保留截图');
 const {PDFDocument,PDFName,PDFHexString}=library,doc=await PDFDocument.create(),groups=[];
 doc.setTitle('Frame Notes Screenshots');doc.setProducer('Frame Notes 1.2.1');
 for(let i=0;i<shots.length;i++){
  const shot=shots[i],bytes=await renderImage(shot),image=await doc.embedPng(bytes);
  const width=595.28,height=width*shot.height/shot.width,page=doc.addPage([width,height]);
  page.drawImage(image,{x:0,y:0,width,height});const r=pageBoxRect(shot.pageBox,width,height);
  if(r){
   const name='FrameNotesPageBox-'+String(shot.number).padStart(3,'0');
   const ocg=doc.context.register(doc.context.obj({Type:'OCG',Name:PDFHexString.fromText('页码白框 #'+String(shot.number).padStart(3,'0')),Usage:{View:{ViewState:'ON'},Print:{PrintState:'ON'}}}));groups.push(ocg);
   const form=doc.context.register(doc.context.flateStream(`q\n1 1 1 rg\n0 0 ${r.width} ${r.height} re f\nQ`,{Type:'XObject',Subtype:'Form',FormType:1,BBox:[0,0,r.width,r.height],Resources:{},OC:ocg}));
   const key=page.node.newXObject(name,form);
   page.node.addContentStream(doc.context.register(doc.context.flateStream(`q\n1 0 0 1 ${r.x} ${height-r.y-r.height} cm\n${key} Do\nQ`)));
  }
  onProgress(i+1,shots.length);await new Promise(resolve=>setTimeout(resolve,0));
 }
 if(groups.length)doc.catalog.set(PDFName.of('OCProperties'),doc.context.obj({OCGs:groups,D:{Name:PDFHexString.fromText('页码预留白框'),BaseState:'ON',ON:groups,Order:groups}}));
 return doc.save();
}
