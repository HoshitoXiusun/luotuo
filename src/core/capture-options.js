export const GALLERY_BYTE_LIMIT=512*1024*1024;

export function captureOptions(value={}) {
 const format=value.captureFormat??'png';
 const quality=value.captureQuality??.92;
 const maxEdge=value.captureMaxEdge??0;
 const template=value.filenameTemplate??'';
 if(!['png','jpeg'].includes(format)||!Number.isFinite(quality)||quality<.1||quality>1||![0,3840,2560,1920,1280,960].includes(maxEdge))throw Error('截图质量设置无效');
 if(typeof template!=='string'||template.length>100||/[{}]/.test(template.replace(/\{(?:source|number|time)\}/g,'')))throw Error('文件名支持 {source}、{number}、{time}');
 return {captureFormat:format,captureQuality:quality,captureMaxEdge:maxEdge,filenameTemplate:template};
}

export function captureDimensions(width,height,maxEdge=0) {
 const scale=maxEdge?Math.min(1,maxEdge/Math.max(width,height)):1;
 return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}

export function screenshotStem(shot,settings,time) {
 captureOptions({filenameTemplate:settings.filenameTemplate});
 const number=String(shot.number).padStart(3,'0');
 const source=String(shot.source?.name??'视频').replace(/\.[^.]+$/,'').slice(0,24);
 const template=settings.filenameTemplate?.trim();
 if(!template)return `${settings.prefix||'视频截图'}_${number}_${time}`;
 let name=template.replace(/\{(source|number|time)\}/g,(_,key)=>({source,number:'⟦序号⟧',time})[key]).slice(0,72);
 if(name.includes('⟦序号⟧'))name=name.replaceAll('⟦序号⟧',number);
 else name+='_'+number;
 return name;
}

export function jpegDimensions(bytes){
 if(bytes[0]!==255||bytes[1]!==216)throw Error('项目 JPG 数据无效');
 let offset=2;
 while(offset+4<=bytes.length){
  if(bytes[offset++]!==255)throw Error('项目 JPG 数据无效');
  while(bytes[offset]===255)offset++;
  const marker=bytes[offset++];
  if(marker===217||marker===218)break;
  if(marker===1||(marker>=208&&marker<=215))continue;
  const length=bytes[offset]*256+bytes[offset+1];
  if(length<2||offset+length>bytes.length)break;
  if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){
   if(length<8)break;
   return {height:bytes[offset+3]*256+bytes[offset+4],width:bytes[offset+5]*256+bytes[offset+6]};
  }
  offset+=length;
 }
 throw Error('项目 JPG 缺少尺寸信息');
}
