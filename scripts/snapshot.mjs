import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
const out=path.join(root,'history','v'+pkg.version+'.json');
try{await fs.access(out);throw Error('快照已存在，请增加版本号')}catch(e){if(e.code!=='ENOENT')throw e}
const hashes={};
async function walk(dir=''){for(const e of await fs.readdir(path.join(root,dir),{withFileTypes:true})){if(['.git','node_modules','history','.DS_Store','_site'].includes(e.name)||e.name.endsWith('.zip'))continue;const rel=path.join(dir,e.name);if(e.isDirectory())await walk(rel);else if(e.isFile())hashes[rel]=createHash('sha256').update(await fs.readFile(path.join(root,rel))).digest('hex')}}
await walk();hashes['history/设计沿革.md']=createHash('sha256').update(await fs.readFile(path.join(root,'history/设计沿革.md'))).digest('hex');
await fs.writeFile(out,JSON.stringify({version:pkg.version,date:'2026-10-09',note:process.argv[2]||'源码与构建成品校验清单；完整代码随 GitHub 提交保存',sha256:hashes},null,2));
console.log('Saved '+out);
