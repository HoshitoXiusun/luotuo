// Gallery-only changes reuse images and their Blob URLs. Display direction is
// independent of the numbering direction fixed by the last basis change.
function shotTimeLink(shot,label=timeText(shot.time)){
 const link=document.createElement('a');link.className='shot-time-link';link.href='#dropzone';link.textContent=label;link.title='跳转到视频 '+timeText(shot.time);link.setAttribute('aria-label',link.title);
 link.onclick=e=>{e.preventDefault();e.stopPropagation();jumpToShot(shot.id).catch(error=>toast(error.message))};return link;
}
async function jumpToShot(id,file=null){
 if(state.busy){toast('请先完成或停止当前任务');return}const shot=state.shots.find(s=>s.id===id);if(!shot)return;
 if(file){const source={name:file.name,size:file.size,lastModified:file.lastModified};if(!matchesShotSource(shot.source,source)){toast('文件不匹配，请选择截图来源视频：'+shot.source.name);return}await loadFile(file);if(!state.ready||!matchesShotSource(shot.source,state.source))return}
 if(!state.ready||!matchesShotSource(shot.source,state.source)){
  if($('preview').open)$('preview').close();const input=$('jumpSourceInput');input.dataset.shotId=id;input.value='';toast('请选择截图的来源视频：'+shot.source.name);input.click();return;
 }
 if(shot.time>=video.duration){toast('截图时间超出当前视频时长，请检查来源视频');return}
 if($('preview').open)$('preview').close();openMode('manual');await navigate(shot.time);$('jumpTime').value=timeText(shot.time);$('dropzone').scrollIntoView({block:'center',behavior:'instant'});$('playBtn').focus({preventScroll:true});
}
$('jumpSourceInput').onchange=async e=>{const file=e.target.files[0],id=Number(e.target.dataset.shotId);e.target.value='';delete e.target.dataset.shotId;if(file)try{await jumpToShot(id,file)}catch(error){toast(error.message)}};
// Both the start and end must be outside: dragging a selection from inside the
// dialog onto the backdrop must not discard the current preview.
let previewOutsidePress=false;
const outsidePreview=e=>{const r=$('preview').getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom};
$('preview').addEventListener('pointerdown',e=>{previewOutsidePress=e.button===0&&outsidePreview(e)});
$('preview').addEventListener('pointercancel',()=>previewOutsidePress=false);
$('preview').addEventListener('click',e=>{const close=previewOutsidePress&&e.target===$('preview')&&outsidePreview(e);previewOutsidePress=false;if(close)$('preview').close()});
$('preview').addEventListener('close',()=>previewOutsidePress=false);
$('jumpTime').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();e.stopPropagation();if(!$('jumpBtn').disabled)$('jumpBtn').click()}});

const sortMenu=$('sortMenu'),sortButton=$('sort');
function positionSortMenu(){const r=sortButton.getBoundingClientRect(),width=sortMenu.offsetWidth,height=sortMenu.offsetHeight;sortMenu.style.left=Math.max(8,Math.min(innerWidth-width-8,r.left))+'px';sortMenu.style.top=(r.bottom+height+8>innerHeight?Math.max(8,r.top-height-5):r.bottom+5)+'px'}
function closeSortMenu(){sortMenu.hidden=true;sortButton.setAttribute('aria-expanded','false')}
function openSortMenu(focus=false){if(state.busy)return;closeExportMenu();sortMenu.hidden=false;sortButton.setAttribute('aria-expanded','true');positionSortMenu();if(focus)sortMenu.querySelector('[aria-checked="true"]')?.focus()}
function updateSortControls(){
 const mode=sortButton.value,direction=state.sortDirections[mode],label=mode==='time'?'视频时间':'截图时间';sortButton.disabled=state.busy;$('sortLabel').textContent=label;$('sortDirection').textContent=direction==='desc'?'↓':'↑';sortButton.setAttribute('aria-label',`截图排序：${label}，${direction==='desc'?'倒序':'正序'}`);sortButton.title='重复选择当前排序可切换正序 / 倒序，编号保持不变';
 for(const item of sortMenu.querySelectorAll('[data-sort]')){item.setAttribute('aria-checked',String(item.dataset.sort===mode));item.querySelector('.sort-option-direction').textContent=state.sortDirections[item.dataset.sort]==='desc'?'↓':'↑'}if(state.busy)closeSortMenu();
}
function updateCardNumber(card,shot){
 if(Number(card.dataset.number)===shot.number)return;card.dataset.number=shot.number;const number=String(shot.number).padStart(3,'0');card.querySelector('.shot-number').textContent='#'+number;card.querySelector('.check input').setAttribute('aria-label','选择截图 #'+number);card.querySelector('.thumb').title='预览截图 #'+number;card.querySelector('.thumb img').alt='截图 #'+number+' · '+timeText(shot.time);card.querySelector('.card-note').setAttribute('aria-label','截图 #'+number+' 备注');card.querySelector('select').setAttribute('aria-label','截图 #'+number+' 水印');
}
function reorderGallery(){
 const gallery=$('gallery'),filter=$('reviewFilter').value,visible=ordered(state.shots).filter(s=>filter==='all'||s.decision===filter),cards=new Map([...gallery.querySelectorAll('.card')].map(card=>[Number(card.dataset.id),card]));
 if(cards.size!==visible.length||visible.some(shot=>!cards.has(shot.id))){renderGallery();return}
 const scroll=gallery.scrollTop;let next=gallery.firstElementChild;
 for(const shot of visible){const card=cards.get(shot.id);updateCardNumber(card,shot);if(card===next)next=next.nextElementSibling;else gallery.insertBefore(card,next)}
 gallery.scrollTop=scroll;if($('preview').open)syncPreviewNavigation();updateControls();state.refreshPageBoxes?.();
}
function selectShotSort(mode){
 if(state.busy)return;const next=changeShotSort({sort:sortButton.value,sortDirections:state.sortDirections,numberDirection:state.numberDirection},mode),basisChanged=next.sort!==sortButton.value;sortButton.value=next.sort;state.sortDirections=next.sortDirections;state.numberDirection=next.numberDirection;if(basisChanged)renumberShots();markDirty();closeSortMenu();reorderGallery();sortButton.focus({preventScroll:true});
}
for(const item of sortMenu.querySelectorAll('[data-sort]'))item.onclick=()=>selectShotSort(item.dataset.sort);
sortButton.onclick=()=>sortMenu.hidden?openSortMenu():closeSortMenu();
sortButton.onkeydown=e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();openSortMenu(true)}};
sortMenu.onkeydown=e=>{const items=[...sortMenu.querySelectorAll('button')];if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();items[(items.indexOf(document.activeElement)+(e.key==='ArrowDown'?1:-1)+items.length)%items.length].focus()}else if(e.key==='Home'||e.key==='End'){e.preventDefault();items[e.key==='Home'?0:items.length-1].focus()}else if(e.key==='Escape'){e.preventDefault();closeSortMenu();sortButton.focus()}};
document.addEventListener('pointerdown',e=>{if(!sortMenu.contains(e.target)&&!sortButton.contains(e.target))closeSortMenu()});document.addEventListener('focusin',e=>{if(!sortMenu.contains(e.target)&&!sortButton.contains(e.target))closeSortMenu()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSortMenu()});window.addEventListener('resize',closeSortMenu);window.addEventListener('scroll',()=>{if(!sortMenu.hidden)positionSortMenu()},true);
state.updateSortControls=updateSortControls;
