import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {normalizePageBox,pageBoxRect,createLayeredPDF,defaultPageBox} from '../src/core/page-box.js';
globalThis.self=globalThis;
await import('../vendor/pdf-lib/pdf-lib.min.js');
delete globalThis.self;
const lib=globalThis.PDFLib,box={width:.32,height:.05,bottom:.015,align:'center'};
function png(){
 const chunk=(name,data)=>{const type=Buffer.from(name),src=Buffer.concat([type,data]);let c=0xffffffff;for(const b of src){c^=b;for(let i=0;i<8;i++)c=(c&1)?0xedb88320^(c>>>1):c>>>1}const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);type.copy(out,4);data.copy(out,8);out.writeUInt32BE((c^0xffffffff)>>>0,out.length-4);return out};
 const header=Buffer.alloc(13);header.writeUInt32BE(16,0);header.writeUInt32BE(16,4);header[8]=8;header[9]=2;const pixels=Buffer.alloc(16*(1+16*3));for(let y=0;y<16;y++)for(let x=0;x<16;x++){const i=y*49+1+x*3;pixels[i]=x*10;pixels[i+1]=y*10;pixels[i+2]=40}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
const source=png(),shots=[{number:1,width:16,height:16,pageBox:box},{number:2,width:16,height:16,pageBox:null}];
test('page boxes validate project values and leave old projects unmodified',()=>{
 assert.equal(normalizePageBox(undefined),null);assert.equal(normalizePageBox(null),null);assert.deepEqual(normalizePageBox(box),box);
 for(const value of [true,[],{...box,width:NaN},{...box,width:2},{...box,height:0},{...box,bottom:-.01},{...box,align:'top'}])assert.throws(()=>normalizePageBox(value),/白框/);
});
test('box positions are relative to screenshot dimensions and stay inside each edge',()=>{
 assert.deepEqual(pageBoxRect({...box,width:.4,height:.1,bottom:.05},1000,2000),{x:300,y:1700,width:400,height:200});
 for(const align of ['left','center','right']){const r=pageBoxRect({...box,align},640,360);assert(r.x>=0&&r.y>=0&&r.x+r.width<=640&&r.y+r.height<=360)}assert.equal(pageBoxRect(null,640,360),null);
});
test('PDF boxes are separate Form XObjects and OCGs; unmarked pages have only an image',async()=>{
 const progress=[],bytes=await createLayeredPDF(shots,{library:lib,renderImage:async()=>source,onProgress:i=>progress.push(i)}),doc=await lib.PDFDocument.load(bytes),pages=doc.getPages();
 assert.equal(pages.length,2);assert.deepEqual(progress,[1,2]);const oc=doc.catalog.lookup(lib.PDFName.of('OCProperties'));assert.equal(oc.lookup(lib.PDFName.of('OCGs')).size(),1);
 for(let i=0;i<2;i++){const objects=pages[i].node.Resources().lookup(lib.PDFName.of('XObject')),types=objects.entries().map(([,ref])=>doc.context.lookup(ref).dict.lookup(lib.PDFName.of('Subtype')).toString());assert.equal(types.filter(t=>t==='/Image').length,1);assert.equal(types.filter(t=>t==='/Form').length,i===0?1:0)}
});
test('removing a box content stream preserves the embedded screenshot exactly',async()=>{
 const bytes=await createLayeredPDF(shots.slice(0,1),{library:lib,renderImage:async()=>source}),doc=await lib.PDFDocument.load(bytes),page=doc.getPages()[0],images=page.node.Resources().lookup(lib.PDFName.of('XObject'));
 const entry=images.entries().find(([,r])=>doc.context.lookup(r).dict.lookup(lib.PDFName.of('Subtype')).toString()==='/Image'),image=doc.context.lookup(entry[1]),before=Buffer.from(image.getContents());assert.equal(page.node.Contents().size(),2);page.node.Contents().remove(1);
 const reopened=await lib.PDFDocument.load(await doc.save()),other=reopened.getPages()[0].node.Resources().lookup(lib.PDFName.of('XObject')),after=reopened.context.lookup(other.get(entry[0]));assert.deepEqual(Buffer.from(after.getContents()),before);assert.equal(reopened.getPages()[0].node.Contents().size(),1);
});

test('small default page boxes follow screenshot width across portrait and landscape',()=>{
 for(const [w,h] of [[592,1280],[640,360],[1080,1920]]){const b=defaultPageBox(w,h),r=pageBoxRect(b,w,h);assert(Math.abs(r.width-w*.145)<1e-8);assert(Math.abs(r.height-w*.026)<1e-8);assert(r.height<h*.05);assert(Math.abs(r.x+r.width/2-w/2)<1e-8);assert(r.y+r.height<h)}
 assert.throws(()=>defaultPageBox(0,360),/尺寸/);
});
