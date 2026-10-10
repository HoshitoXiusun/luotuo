$('previewCompatNote').hidden=!stableLivePreview;
const appIcons=__ICONS__;
function mountIcons(){for(const el of document.querySelectorAll('[data-icon]'))el.innerHTML=appIcons[el.dataset.icon]||appIcons['video-frames']}
function openMode(id){if(state.busy){toast('请先完成或停止当前任务');return}if(!['manual','batch','audio'].includes(id))return;state.functionId=id;for(const button of document.querySelectorAll('[data-mode]')){const active=button.dataset.mode===id;button.classList.toggle('active',active);button.setAttribute('aria-current',active?'page':'false')}$('singlePane').hidden=id!=='manual';$('batchPane').hidden=id!=='batch';$('audioPane').hidden=id!=='audio';$('captureBtn').hidden=id!=='manual';document.querySelector('.keyboard').hidden=id!=='manual';if(id==='batch')estimateBatch()}
for(const button of document.querySelectorAll('[data-mode]'))button.onclick=()=>openMode(button.dataset.mode);
$('aboutBtn').onclick=()=>$('about').showModal();$('closeAbout').onclick=()=>$('about').close();$('undoBtn').onclick=undoAction;$('previousPreview').onclick=()=>movePreview(-1);$('nextPreview').onclick=()=>movePreview(1);$('saveProjectBtn').onclick=saveProject;$('restoreProjectBtn').onclick=()=>$('projectInput').click();$('projectInput').onchange=e=>{restoreProject(e.target.files[0]);e.target.value=''};
for(const id of ['quality','format','caseName','prefix','fps'])$(id).addEventListener('input',markDirty);for(const id of ['batchStart','batchEnd','batchStep','batchMode','fps'])$(id).addEventListener('input',estimateBatch);video.addEventListener('loadeddata',estimateBatch);
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('toast').hidden=true});
$('downloadSiteBtn').onclick=async()=>{try{const html=siteMarkup.replace('__SCRIPT__',()=>$('frameApp').textContent);await save(new Blob([html],{type:'text/html;charset=utf-8'}),'index.html');toast('离线页面已下载；用浏览器打开即可使用')}catch(e){toast('下载失败：'+e.message)}};
// This pristine template plus the original script reproduces the page without user media or notes.
const siteMarkup=__SITE_MARKUP__;
mountIcons();openMode('manual');updateControls();
