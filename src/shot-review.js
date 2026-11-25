const reviewLabels={duplicate:'疑似重复',gap:'滚动衔接不足',scroll:'滚动衔接',scene:'场景切换',changed:'局部变化'};
const reviewPixels=new WeakMap();
let reviewFindings=new WeakMap(),reviewWorker=null,reviewCancelled=false;

function resetReviewFindings(){reviewFindings=new WeakMap();}

function reviewResult(shot) {
 return reviewFindings.get(shot)||null;
}

function reviewReason(result) {
 const previous='#'+String(result.previous.number).padStart(3,'0');
 const direction=result.axis==='x'?'横向':'纵向';
 const details={
  duplicate:'两张画面高度相近。请放大确认细节后决定是否排除。',
  gap:`检测到${direction}移动，估计重合 ${result.overlap}%。建议检查这段视频是否需要补截。`,
  scroll:`检测到${direction}移动，估计重合 ${result.overlap}%。`,
  scene:'画面整体发生变化，建议核对前后截图。',
  changed:'主体相近但有局部变化，建议放大核对并保留。'
 };
 return `与 ${previous} 对比 · ${result.exact?'图片内容完全相同。建议排除重复图。':details[result.type]}`;
}

function updateReviewCard(card,shot) {
 const finding=reviewResult(shot), badge=card.querySelector('.review-badge');
 badge.hidden=!finding;
 if(finding) {
  badge.textContent=reviewLabels[finding.type];
  badge.dataset.type=finding.type;
  badge.title=reviewReason(finding);
 }
}

function matchesGalleryFilter(shot,filter) {
 return filter==='all'||(filter==='review'?Boolean(reviewResult(shot)):shot.decision===filter);
}

function updateReviewControls(){
 let total=0,suggestions=0;
 for(const shot of state.shots){const result=reviewResult(shot);if(result){total++;if(result.type==='duplicate'&&shot.decision!=='exclude')suggestions++}}
 $('analyzeShots').disabled=state.busy||state.shots.length<2;
 $('reviewFilterOption').disabled=!total;
 $('reviewFilterOption').textContent=`仅显示复核建议（${total}）`;
 $('analyzeShots').textContent=state.reviewing?'复核中…':total?`复核建议 ${total}`:'智能复核';
 $('reviewStatus').textContent=state.reviewing?'正在分析画面…':total?`${total} 条复核提示 · ${suggestions} 张建议排除`:'按来源及视频时间分析画面';
 $('applyReviewExclusions').disabled=state.busy||!suggestions;
 $('cancelReview').hidden=!state.reviewing;
 if(!total&&$('reviewFilter').value==='review')$('reviewFilter').value='all';
}
function applyReviewExclusions(){
 if(state.busy)return;
 const values=state.shots.filter(shot=>reviewResult(shot)?.type==='duplicate'&&shot.decision!=='exclude');
 if(!values.length)return;
 pushUndo({type:'decisions',values:values.map(shot=>({id:shot.id,previous:shot.decision,selected:shot.selected}))});
 for(const shot of values){shot.decision='exclude';shot.selected=false}
 markDirty();renderGallery();toast(`已按建议排除 ${values.length} 张，可撤销`);
}
$('applyReviewExclusions').onclick=applyReviewExclusions;
$('cancelReview').onclick=()=>{reviewCancelled=true;reviewWorker?.terminate();state.cancelReviewRequest?.();};

async function reviewImage(shot,canvas,context) {
 if(reviewPixels.has(shot))return reviewPixels.get(shot);
 const bitmap=await createImageBitmap(shot.blob);
 try {
  context.fillStyle='#000';context.fillRect(0,0,REVIEW_SIDE,REVIEW_SIDE);
  context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const data=context.getImageData(0,0,canvas.width,canvas.height).data;
  reviewPixels.set(shot,data);
  return data;
 } finally {bitmap.close();}
}

async function analyzeShots(){
 if(state.busy||state.shots.length<2)return;
 state.busy=true;state.reviewing=true;reviewCancelled=false;updateControls();
 const shots=sortShots(state.shots,'time','asc'),byId=new Map(shots.map(shot=>[shot.id,shot])),found=new Map();
 let skipped=0;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=REVIEW_SIDE;
 const context=canvas.getContext('2d',{willReadFrequently:true});
 try{
  try{reviewWorker=createReviewWorker()}catch{}
  const previousBySource=new Map(),fallbackFingerprints=new Map();
  for(const [i,shot] of shots.entries()){
   if(reviewCancelled)break;
   const source=JSON.stringify([shot.source.name,shot.source.size,shot.source.lastModified]);
   let response;
   if(reviewWorker){
    response=await new Promise(resolve=>{
     state.cancelReviewRequest=()=>resolve(null);
     reviewWorker.onmessage=event=>resolve(event.data);
     reviewWorker.onerror=()=>{reviewWorker.terminate();reviewWorker=null;resolve(null)};
     reviewWorker.postMessage({source,shot:{id:shot.id,width:shot.width,height:shot.height,blob:shot.blob}});
    });
    state.cancelReviewRequest=null;
   }
   if(response?.error){reviewWorker?.terminate();reviewWorker=null;response=null;}
   if(!response&&!reviewCancelled){
    const previous=previousBySource.get(source);
    try{
     const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await shot.blob.arrayBuffer())),n=>n.toString(16).padStart(2,'0')).join('');
     const key=source+'|'+shot.width+'x'+shot.height+'|'+digest;
     if(fallbackFingerprints.has(key))response={previousId:fallbackFingerprints.get(key),result:{type:'duplicate',exact:true}};
     else{
      fallbackFingerprints.set(key,shot.id);
      if(previous&&previous.width===shot.width&&previous.height===shot.height){
       const a=await reviewImage(previous,canvas,context),b=await reviewImage(shot,canvas,context);
       response={previousId:previous.id,result:compareReviewFrames(a,b)};
      }
     }
    }catch{skipped++}
    await new Promise(resolve=>setTimeout(resolve,0));
   }
   if(reviewCancelled)break;
   if(response?.error)skipped++;
   if(response?.result&&byId.has(response.previousId))found.set(shot,{...response.result,previous:byId.get(response.previousId)});
   if(response?.result?.type!=='duplicate')previousBySource.set(source,shot);
   if(i%5===0){$('reviewStatus').textContent=`正在复核 ${i+1}/${shots.length}`;await new Promise(resolve=>setTimeout(resolve,0))}
  }
  reviewFindings=new WeakMap(found);
  galleryPage=0;$('reviewFilter').value=found.size?'review':'all';
  toast(`${reviewCancelled?'已停止，保留':'已生成'} ${found.size} 条复核建议`+(skipped?` · ${skipped} 组读取失败`:''));
 }catch(error){toast('复核失败：'+error.message)}
 finally{
  reviewWorker?.terminate();reviewWorker=null;state.cancelReviewRequest=null;
  canvas.width=0;state.busy=false;state.reviewing=false;renderGallery();
 }
}

function renderPreviewReview(shot) {
 const finding=reviewResult(shot);
 $('previewReview').hidden=!finding;
 if(!finding)return;
 $('previewReviewLabel').textContent=reviewLabels[finding.type];
 $('previewReviewReason').textContent=reviewReason(finding);
 $('previewReviewCompare').onclick=()=>openPreview(finding.previous.id);
 $('previewReviewDecision').textContent=shot.decision==='exclude'?'恢复为保留':'标记为排除';
 $('previewReviewDecision').disabled=state.busy;
 $('previewReviewDecision').onclick=()=>setDecision(shot.id,shot.decision==='exclude'?'keep':'exclude');
}

$('analyzeShots').onclick=analyzeShots;
