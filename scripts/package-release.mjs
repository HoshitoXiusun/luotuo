import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {version}=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('发布版本号无效');
const output=path.join(root,'release-assets');
await fs.mkdir(output,{recursive:true});
const source=[];
async function walk(directory=''){
 const entries=await fs.readdir(path.join(root,directory),{withFileTypes:true});
 for(const entry of entries){
  if(['.git','node_modules','release-assets','_site','.DS_Store'].includes(entry.name)||entry.name.endsWith('.zip')||entry.name.endsWith('.log'))continue;
  const relative=path.join(directory,entry.name);
  if(entry.isSymbolicLink())throw Error('源码包含符号链接：'+relative);
  if(entry.isDirectory())await walk(relative);
  else if(entry.isFile())source.push(relative);
 }
}
await walk();source.sort();
const offline=`FrameRight-v${version}-offline.html`;
const sourceZip=`FrameRight-v${version}-source.zip`;
const staticZip=`FrameRight-v${version}-static.zip`;
await fs.copyFile(path.join(root,'index.html'),path.join(output,offline));
const python=String.raw`
import json, sys
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
args=json.load(sys.stdin)
root, output=Path(args['root']), Path(args['output'])
def archive(name, entries):
 with ZipFile(output/name,'w',compression=ZIP_DEFLATED,compresslevel=6) as bundle:
  for local, archived in entries:
   entry=ZipInfo(archived.replace('\\','/'),date_time=(1980,1,1,0,0,0))
   entry.compress_type=ZIP_DEFLATED
   bundle.writestr(entry,(root/local).read_bytes(),compresslevel=6)
 with ZipFile(output/name) as bundle:
  assert bundle.testzip() is None
  for local, archived in entries:
   assert bundle.read(archived)==(root/local).read_bytes()
archive(args['sourceZip'],[(name,name) for name in args['source']])
archive(args['staticZip'],[('index.html','index.html'),('docs/国内离线与部署.txt','使用与部署说明.txt')])
`;
const processResult=spawnSync('python3',['-c',python],{input:JSON.stringify({root,output,source,sourceZip,staticZip}),encoding:'utf8'});
if(processResult.status!==0)throw Error(processResult.stderr||'发布包生成失败');
const files=[offline,sourceZip,staticZip];
const hashes=[];
for(const name of files){
 const content=await fs.readFile(path.join(output,name));
 hashes.push(createHash('sha256').update(content).digest('hex')+'  '+name);
}
await fs.writeFile(path.join(output,'SHA256SUMS.txt'),hashes.join('\n')+'\n');
console.log(JSON.stringify({version,directory:output,assets:[...files,'SHA256SUMS.txt']}));
