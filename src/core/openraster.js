// OpenRaster: first ZIP entry is an uncompressed, exact MIME string. Layer
// order is top first; removing data/page-box.png leaves data/screenshot.png.
export function openRasterFiles(width,height,{image,overlay,merged,thumbnail,x,y}){
 if(![width,height].every(n=>Number.isInteger(n)&&n>0)||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height)throw Error('图层尺寸或位置无效');
 const xml=`<?xml version="1.0" encoding="UTF-8"?><image version="0.0.6" w="${width}" h="${height}" name="Frame Notes"><stack><layer name="页码框" src="data/page-box.png" x="${x}" y="${y}" opacity="1.0" visibility="visible" composite-op="svg:src-over"/><layer name="截图" src="data/screenshot.png" x="0" y="0" opacity="1.0" visibility="visible" composite-op="svg:src-over"/></stack></image>`;
 return [{name:'mimetype',blob:new Blob(['image/openraster'])},{name:'stack.xml',blob:new Blob([xml],{type:'text/xml;charset=utf-8'})},{name:'data/screenshot.png',blob:image},{name:'data/page-box.png',blob:overlay},{name:'mergedimage.png',blob:merged},{name:'Thumbnails/thumbnail.png',blob:thumbnail}];
}
