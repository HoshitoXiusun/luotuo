import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=name=>fs.readFile(path.join(root,name),'utf8');
let template=await read('src/index.html');const css=await read('src/styles.css');
const csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob: data:; media-src blob:; connect-src 'none'; worker-src blob:; object-src 'none'; base-uri 'none'; form-action 'none'";
const iconURI=async(name,type)=>'data:'+type+';base64,'+(await fs.readFile(path.join(root,'src/assets',name))).toString('base64');
template=template.replace('__FAVICON_PNG__',await iconURI('favicon-32.png','image/png')).replace('__FAVICON_SVG__',await iconURI('favicon.svg','image/svg+xml')).replace('__TOUCH_ICON__',await iconURI('apple-touch-icon.png','image/png'));
const license=(await read('LICENSE-Docsy')).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const pdfLicense=(await read('vendor/pdf-lib/LICENSE.md')).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
template=template.replace('__CSS__',()=>css).replace('__CSP__',csp).replace('__LICENSE__',()=>license).replace('__PDF_LICENSE__',()=>pdfLicense);
const sources=['src/core/file-path.js','src/core/shots.js','src/core/shortcuts.js','src/core/capture-options.js','src/core/batch-pipeline.js','src/core/mp4-avc.js','src/core/shot-review.js','src/core/batch-recommendation.js','src/core/audio.js','src/core/host.js','src/core/hover-preview.js','src/core/video-display.js','src/core/page-box.js','src/core/openraster.js','src/core/compression.js','src/video.js','src/dense-capture.js','src/capture-options.js','src/gallery-thumbnails.js','src/audio.js','src/video-display.js','src/hover-preview.js','src/core/project.js','src/page-box.js','src/export.js','src/gallery.js','src/review-worker.js','src/shot-review.js','src/batch-recommendation.js','src/compression.js','src/shortcuts.js','src/app.js'];
const svg=(await read('src/assets/video-frames.svg')).replace(/stroke="#000"/g,'stroke="currentColor"');
let script=(await Promise.all(sources.map(read))).map(s=>s.replace(/^import [^\n]+\n/gm,'').replace(/export /g,'')).join('\n');
script=script.replace('__ICONS__',()=>JSON.stringify({'video-frames':svg})).replace('__SITE_MARKUP__',()=>JSON.stringify(template));
script=(await read('vendor/pdf-lib/pdf-lib.min.js'))+'\n'+script;
script=script.replace(/<\/script/gi,'<\\/script');new Function(script);
const html=template.replace('__SCRIPT__',()=>script);
await fs.mkdir(path.join(root,'dist'),{recursive:true});await fs.writeFile(path.join(root,'index.html'),html);await fs.writeFile(path.join(root,'dist/index.html'),html);await fs.writeFile(path.join(root,'.nojekyll'),'');
console.log('Built standalone FrameRight index.html ('+Buffer.byteLength(html)+' bytes).');

for(const name of ['favicon.svg','favicon.ico','favicon-32.png','apple-touch-icon.png']){await fs.copyFile(path.join(root,'src/assets',name),path.join(root,name));await fs.copyFile(path.join(root,'src/assets',name),path.join(root,'dist',name))}
