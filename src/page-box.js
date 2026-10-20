function pageBoxOptions(shot){if($('pageBoxSizing').value==='auto')return defaultPageBox(shot.width,shot.height);return normalizePageBox({width:Number($('pageBoxWidth').value)/100,height:Number($('pageBoxHeight').value)/100,bottom:Number($('pageBoxBottom').value)/100,align:$('pageBoxAlign').value})}
function pageBoxTargets(){return state.shots.filter(s=>s.decision!=='exclude'&&($('pageBoxScope').value==='all'||s.selected))}
function changePageBoxes(remove=false){
 if(state.busy)return;try{const targets=pageBoxTargets();if(!targets.length)throw Error('请先勾选截图，或将应用范围改为全部保留截图');const values=targets.map(shot=>({shot,value:remove?null:pageBoxOptions(shot)}));
 pushUndo({type:'pageBox',values:targets.map(s=>({id:s.id,previous:s.pageBox?{...s.pageBox}:null}))});for(const {shot,value} of values)shot.pageBox=value?{...value}:null;
 markDirty();renderGallery();if($('preview').open)refreshPreviewPageBox();toast(`${remove?'已移除':'已添加'} ${targets.length} 张截图的独立页码白框`);
 }catch(e){toast(e.message)}
}
function updatePageBoxControls(){
 const kept=state.shots.filter(s=>s.decision!=='exclude'),selected=kept.filter(s=>s.selected);$('pageBoxCount').textContent=kept.filter(s=>s.pageBox).length+' 张已设置';
 $('pageBoxScope').options[0].textContent=`已选截图（${selected.length} 张）`;$('pageBoxScope').options[1].textContent=`全部保留截图（${kept.length} 张）`;
 for(const id of ['applyPageBox','removePageBox'])$(id).disabled=state.busy||!pageBoxTargets().length;
 $('layeredPdfBtn').disabled=state.busy||!shotsForExport().length;
 for(const id of ['pageBoxSizing','pageBoxScope','pageBoxAlign','pageBoxWidth','pageBoxHeight','pageBoxBottom'])$(id).disabled=state.busy;
 $('previewPageBox').disabled=state.busy;
}
function positionPageBox(element,shot,frame){
 const rect=pageBoxRect(shot.pageBox,shot.width,shot.height);element.hidden=!rect;if(!rect)return;
 const scale=Math.min(frame.clientWidth/shot.width,frame.clientHeight/shot.height),x=(frame.clientWidth-shot.width*scale)/2,y=(frame.clientHeight-shot.height*scale)/2;
 Object.assign(element.style,{left:(x+rect.x*scale)+'px',top:(y+rect.y*scale)+'px',width:rect.width*scale+'px',height:rect.height*scale+'px'});
}
const pageBoxObserver=new ResizeObserver(()=>{positionGalleryPageBoxes();refreshPreviewPageBox()});
function positionGalleryPageBoxes(){for(const card of $('gallery').querySelectorAll('.card')){const shot=state.shots.find(s=>s.id===Number(card.dataset.id)),frame=card.querySelector('.thumb'),overlay=frame.querySelector('.page-number-box');if(overlay)positionPageBox(overlay,shot,frame)}}
function refreshPageBoxes(){
 pageBoxObserver.disconnect();for(const card of $('gallery').querySelectorAll('.card')){const shot=state.shots.find(s=>s.id===Number(card.dataset.id)),frame=card.querySelector('.thumb');let overlay=frame.querySelector('.page-number-box');if(!overlay){overlay=document.createElement('span');overlay.className='page-number-box';overlay.setAttribute('aria-hidden','true');frame.append(overlay)}positionPageBox(overlay,shot,frame);pageBoxObserver.observe(frame)}
 if($('preview').open)pageBoxObserver.observe($('previewImage'));
}
function refreshPreviewPageBox(){const shot=state.shots.find(s=>s.id===state.previewId);if(!shot)return;$('previewPageBox').checked=!!shot.pageBox;positionPageBox($('previewPageBoxOverlay'),shot,$('previewImage'))}
$('pageBoxSizing').onchange=()=>$('pageBoxCustom').hidden=$('pageBoxSizing').value!=='custom';
$('pageBoxScope').onchange=updatePageBoxControls;$('applyPageBox').onclick=()=>changePageBoxes();$('removePageBox').onclick=()=>changePageBoxes(true);
$('previewPageBox').onchange=()=>{if(state.busy)return;try{const shot=state.shots.find(s=>s.id===state.previewId);if(!shot)return;pushUndo({type:'pageBox',values:[{id:shot.id,previous:shot.pageBox?{...shot.pageBox}:null}]});shot.pageBox=$('previewPageBox').checked?(shot.pageBox||pageBoxOptions(shot)):null;markDirty();refreshPageBoxes();refreshPreviewPageBox();updateControls()}catch(e){toast(e.message);refreshPreviewPageBox()}};
$('previewImage').addEventListener('load',()=>{refreshPreviewPageBox();pageBoxObserver.observe($('previewImage'))});
$('layeredPdfBtn').onclick=async()=>{if(state.busy)return;closeExportMenu();const shots=shotsForExport().map(s=>({...s,pageBox:s.pageBox?{...s.pageBox}:null})),s=settings();if(!shots.length)return;state.busy=true;updateControls();try{
 const bytes=await createLayeredPDF(shots,{library:PDFLib,renderImage:async shot=>new Uint8Array(await (await output(shot,s,true)).arrayBuffer()),onProgress:(i,n)=>setExportProgress(`生成 PDF ${i}/${n}`)});
 if(await save(new Blob([bytes],{type:'application/pdf'}),safeName(s.caseName||s.prefix)+'_截图.pdf'))toast('PDF 已按截图集顺序导出');
 }catch(e){toast('PDF 导出失败：'+e.message)}finally{state.busy=false;$('layeredPdfBtn').textContent='导出为 PDF';updateControls()}};
state.updatePageBoxControls=updatePageBoxControls;state.refreshPageBoxes=refreshPageBoxes;
