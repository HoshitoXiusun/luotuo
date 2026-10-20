import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {openRasterFiles} from '../src/core/openraster.js';
const fixture={image:new Blob(['base']),overlay:new Blob(['box']),merged:new Blob(['merged']),thumbnail:new Blob(['thumb']),x:100,y:200};
test('OpenRaster keeps exact mimetype first and the removable box above the original',async()=>{
 const files=openRasterFiles(640,360,fixture);assert.equal(files[0].name,'mimetype');assert.equal(await files[0].blob.text(),'image/openraster');const xml=await files[1].blob.text();assert(xml.indexOf('data/page-box.png')<xml.indexOf('data/screenshot.png'));assert(xml.includes('x="100" y="200"'));assert.equal((xml.match(/<layer /g)||[]).length,2);
 assert.equal(files.find(f=>f.name==='data/screenshot.png').blob,fixture.image);assert(files.some(f=>f.name==='mergedimage.png'));assert(files.some(f=>f.name==='Thumbnails/thumbnail.png'));
});
test('OpenRaster rejects positions outside their own axis',()=>{
 assert.throws(()=>openRasterFiles(360,640,{...fixture,x:400}),/无效/);assert.throws(()=>openRasterFiles(640,360,{...fixture,y:400}),/无效/);assert.throws(()=>openRasterFiles(0,360,fixture),/无效/);
});
test('export preferences default to no CSV or metadata, preserve layers, and reject malformed projects',()=>{
 const context=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../src/core/project.js',import.meta.url),'utf8'),context);
 const defaults=vm.runInContext('normalizedSettings({})',context);assert.equal(defaults.exportCSV,false);assert.equal(defaults.exportMetadata,false);assert.equal(defaults.exportLayers,true);
 const selected=vm.runInContext('normalizedSettings({exportCSV:true,exportMetadata:true,exportLayers:false})',context);assert.equal(selected.exportCSV,true);assert.equal(selected.exportMetadata,true);assert.equal(selected.exportLayers,false);assert.throws(()=>vm.runInContext('normalizedSettings({exportCSV:"yes"})',context),/导出选项/);
});
