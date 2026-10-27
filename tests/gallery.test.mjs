import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {assignShotNumbers,sortShots,sortPreferences,changeShotSort,matchesShotSource} from '../src/core/shots.js';
const source={name:'anonymous.webm',size:10,lastModified:2};
const fixture=()=>[4,1,3,2].map((time,i)=>({id:i+1,time,source,createdAt:new Date(i*1000).toISOString()}));
test('new sorting defaults to descending and remembers each basis independently',()=>{
 let p=sortPreferences();assert.deepEqual(p,{sort:'time',sortDirections:{time:'desc',capture:'desc'},numberDirection:'desc'});
 p=changeShotSort(p,'time');assert.equal(p.sortDirections.time,'asc');assert.equal(p.numberDirection,'desc');
 p=changeShotSort(p,'capture');assert.equal(p.sortDirections.capture,'desc');assert.equal(p.numberDirection,'desc');
 p=changeShotSort(p,'capture');assert.equal(p.sortDirections.capture,'asc');assert.equal(p.numberDirection,'desc');
 p=changeShotSort(p,'time');assert.equal(p.sortDirections.time,'asc');assert.equal(p.numberDirection,'asc');
 p=changeShotSort(p,'time');p=changeShotSort(p,'capture');assert.equal(p.sortDirections.capture,'asc');assert.equal(p.numberDirection,'asc');
});
test('basis changes renumber filenames, while direction flips preserve all numbers',()=>{
 const shots=fixture();let p=sortPreferences();const apply=()=>assignShotNumbers(shots,p.sort,p.numberDirection),view=()=>sortShots(shots,p.sort,p.sortDirections[p.sort]).map(s=>[s.id,s.number]);
 apply();assert.deepEqual(view(),[[1,1],[3,2],[4,3],[2,4]]);p=changeShotSort(p,'time');apply();assert.deepEqual(view(),[[2,4],[4,3],[3,2],[1,1]]);
 p=changeShotSort(p,'capture');apply();assert.deepEqual(view(),[[4,1],[3,2],[2,3],[1,4]]);p=changeShotSort(p,'capture');apply();assert.deepEqual(view(),[[1,4],[2,3],[3,2],[4,1]]);
 p=changeShotSort(p,'time');apply();assert.deepEqual(view(),[[2,1],[4,2],[3,3],[1,4]]);
});
test('number updates skip unchanged shots and preserve blobs and capture identities',()=>{
 const shots=fixture(),writes=[];assignShotNumbers(shots,'time','desc');for(const s of shots){let number=s.number;s.blob=new Blob([String(s.id)]);Object.defineProperty(s,'number',{get:()=>number,set:n=>{writes.push(s.id);number=n},enumerable:true})}
 const blobs=shots.map(s=>s.blob);assignShotNumbers(shots,'time','desc');assert.deepEqual(writes,[]);assignShotNumbers(shots,'capture','desc');assert.deepEqual(writes.sort(),[1,2,4]);assert.deepEqual(shots.map(s=>s.blob),blobs);assert.deepEqual(shots.map(s=>s.id),[1,2,3,4]);
});
test('inserting, deleting and undoing keep dense numbers in the chosen naming direction',()=>{
 const shots=fixture();assignShotNumbers(shots,'time','desc');shots.push({id:5,time:5,source});assignShotNumbers(shots,'time','desc');const removed=shots.splice(1,1)[0];assignShotNumbers(shots,'time','desc');assert.deepEqual(sortShots(shots,'time','desc').map(s=>s.number),[1,2,3,4]);shots.push(removed);assignShotNumbers(shots,'time','desc');assert.deepEqual(sortShots(shots,'time','desc').map(s=>s.number),[1,2,3,4,5]);
});
test('capture sorting uses creation timestamps with a stable id tie-breaker',()=>{
 const shots=[{id:3,createdAt:'2026-01-01T00:00:00Z'},{id:1,createdAt:'2026-01-02T00:00:00Z'},{id:2,createdAt:'2026-01-02T00:00:00Z'}];assert.deepEqual(sortShots(shots,'capture','desc').map(s=>s.id),[2,1,3]);assert.deepEqual(sortShots(shots,'capture','asc').map(s=>s.id),[3,1,2]);
});
test('source matching requires name, size and modification time before seeking',()=>{
 assert(matchesShotSource(source,{...source}));for(const other of [null,{...source,name:'different.webm'},{...source,size:11},{...source,lastModified:3}])assert.equal(matchesShotSource(source,other),false);
});
test('project settings round-trip the display directions and separate numbering direction',()=>{
 const context=vm.createContext({sortPreferences});vm.runInContext(fs.readFileSync(new URL('../src/core/project.js',import.meta.url),'utf8'),context);const prefs={sort:'capture',sortDirections:{time:'asc',capture:'desc'},numberDirection:'asc'};context.preferences=prefs;const s=vm.runInContext('normalizedSettings(preferences)',context);assert.deepEqual(sortPreferences(s),prefs);assert.deepEqual(sortPreferences(vm.runInContext('normalizedSettings({sort:"time"})',context)),sortPreferences());
 for(const invalid of [{sort:'bad'},{sortDirections:[]},{sortDirections:null},{sortDirections:{time:'bad'}},{numberDirection:'bad'}])assert.throws(()=>sortPreferences(invalid),/排序/);
});
