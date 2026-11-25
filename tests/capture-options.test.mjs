import test from 'node:test';
import assert from 'node:assert/strict';
import {captureDimensions,captureOptions,screenshotStem,jpegDimensions} from '../src/core/capture-options.js';
import {createCapturePlan,GALLERY_LIMIT} from '../src/core/shots.js';

test('old settings retain native lossless capture and changed settings validate',()=>{
 assert.deepEqual(captureOptions({}),{captureFormat:'png',captureQuality:.92,captureMaxEdge:0,filenameTemplate:''});
 assert.deepEqual(captureDimensions(1080,1920,1280),{width:720,height:1280});
 assert.deepEqual(captureDimensions(640,360,1920),{width:640,height:360});
 assert.throws(()=>captureOptions({captureQuality:1.1}),/无效/);
 assert.throws(()=>captureOptions({filenameTemplate:'证据_{missing}'}),/文件名/);
});
test('custom screenshot stems keep unique ordering even for long templates or source names',()=>{
 const shot={number:3,source:{name:'取证.mp4'}};
 assert.equal(screenshotStem(shot,{prefix:'视频截图'},'00-00-01.000'),'视频截图_003_00-00-01.000');
 assert.equal(screenshotStem(shot,{filenameTemplate:'证据_{source}_{number}_{time}'},'00-00-01.000'),'证据_取证_003_00-00-01.000');
 assert.equal(screenshotStem(shot,{filenameTemplate:'证据'},'time'),'证据_003');
 assert.match(screenshotStem(shot,{filenameTemplate:'字'.repeat(90)+'_{number}'},'time'),/_003$/);
});
test('larger capture plans reach two thousand shots and reject overflow before decoding',()=>{
 assert.equal(GALLERY_LIMIT,2000);
 const plan=createCapturePlan({mode:'time',start:'',end:'',step:.1,frameRate:25,duration:200});
 assert.equal(plan.count,2000);
 assert.throws(()=>createCapturePlan({mode:'time',step:.1,frameRate:25,duration:201}),/超过图库/);
});

test('JPG project dimensions are checked before browser decoding',()=>{
 const header=Uint8Array.from([255,216,255,192,0,11,8,1,224,2,128,1,1,17,0]);
 assert.deepEqual(jpegDimensions(header),{width:640,height:480});
 assert.throws(()=>jpegDimensions(Uint8Array.of(255,216,255,218,0,2)),/缺少尺寸/);
});
