async function createShotORA(shot,s){
 const image=await output(shot,s,true),r=pageBoxRect(shot.pageBox,shot.width,shot.height);if(!r)throw Error('此张截图未设置页码框');
 const x=Math.max(0,Math.min(shot.width-1,Math.round(r.x))),y=Math.max(0,Math.min(shot.height-1,Math.round(r.y))),box=document.createElement('canvas');
 box.width=Math.max(1,Math.min(shot.width-x,Math.round(r.width)));box.height=Math.max(1,Math.min(shot.height-y,Math.round(r.height)));const bx=box.getContext('2d');bx.fillStyle='#fff';bx.fillRect(0,0,box.width,box.height);
 const merged=document.createElement('canvas');merged.width=shot.width;merged.height=shot.height;const context=merged.getContext('2d'),bitmap=await createImageBitmap(image);try{context.drawImage(bitmap,0,0)}finally{bitmap.close()}context.drawImage(box,x,y);
 const thumb=document.createElement('canvas'),scale=Math.min(1,256/shot.width,256/shot.height);thumb.width=Math.max(1,Math.round(shot.width*scale));thumb.height=Math.max(1,Math.round(shot.height*scale));thumb.getContext('2d').drawImage(merged,0,0,thumb.width,thumb.height);
 const files=openRasterFiles(shot.width,shot.height,{image,overlay:await canvasBlob(box),merged:await canvasBlob(merged),thumbnail:await canvasBlob(thumb),x,y});return zipArchive(files);
}
function setExportProgress(text){$('exportBtn').textContent='导出中';$('exportBtn').title=text}
function updateExportControls(){const any=!!shotsForExport().length;$('exportBtn').disabled=state.busy||!any;if(!state.busy)$('exportBtn').textContent='导出⌄';else closeExportMenu();$('exportBtn').title=$('exportHint').textContent;for(const id of ['exportCSV','exportMetadata','exportLayers'])$(id).disabled=state.busy}
const exportButton=$('exportBtn'),exportMenu=$('exportMenu');let exportCloseTimer;
function positionExportMenu(){const r=exportButton.getBoundingClientRect(),width=168,height=exportMenu.offsetHeight;exportMenu.style.left=Math.max(8,Math.min(innerWidth-width-8,r.right-width))+'px';exportMenu.style.top=(r.bottom+height+8>innerHeight?Math.max(8,r.top-height-5):r.bottom+5)+'px'}
function openExportMenu(focus=false){clearTimeout(exportCloseTimer);if(exportButton.disabled)return;exportMenu.hidden=false;exportButton.setAttribute('aria-expanded','true');positionExportMenu();if(focus)exportMenu.querySelector('button:not(:disabled)')?.focus()}
function closeExportMenu(){clearTimeout(exportCloseTimer);exportMenu.hidden=true;exportButton.setAttribute('aria-expanded','false')}
function deferCloseExport(){clearTimeout(exportCloseTimer);exportCloseTimer=setTimeout(()=>{if(!exportMenu.contains(document.activeElement))closeExportMenu()},160)}
exportButton.onclick=()=>openExportMenu();exportButton.onpointerenter=()=>openExportMenu();exportButton.onpointerleave=deferCloseExport;exportMenu.onpointerenter=()=>clearTimeout(exportCloseTimer);exportMenu.onpointerleave=deferCloseExport;
exportButton.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();openExportMenu(true)}};
exportMenu.onkeydown=e=>{const items=[...exportMenu.querySelectorAll('button:not(:disabled)')];if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const i=items.indexOf(document.activeElement);items[(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus()}else if(e.key==='Escape'){e.preventDefault();closeExportMenu();exportButton.focus()}};
document.addEventListener('pointerdown',e=>{if(!exportMenu.contains(e.target)&&!exportButton.contains(e.target))closeExportMenu()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeExportMenu()});document.addEventListener('focusin',e=>{if(!exportMenu.contains(e.target)&&!exportButton.contains(e.target))closeExportMenu()});window.addEventListener('resize',closeExportMenu);window.addEventListener('scroll',()=>{if(!exportMenu.hidden)positionExportMenu()},true);
for(const id of ['exportCSV','exportMetadata','exportLayers'])$(id).onchange=markDirty;
state.updateExportControls=updateExportControls;
