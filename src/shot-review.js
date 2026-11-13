const reviewLabels={duplicate:'疑似重复',gap:'滚动衔接不足',scroll:'滚动衔接',scene:'场景切换',changed:'局部变化'};
const reviewPixels=new WeakMap();
let reviewFindings=new WeakMap();

function resetReviewFindings() {reviewFindings=new WeakMap();}

function reviewResult(shot) {
 const result=reviewFindings.get(shot);
 if (!result || !state.shots.includes(result.previous)) return null;
 return result;
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
 return `与 ${previous} 对比 · ${details[result.type]}`;
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

function updateReviewControls() {
 const total=state.shots.filter(shot=>reviewResult(shot)).length;
 $('analyzeShots').disabled=state.busy||state.shots.length<2;
 $('reviewFilterOption').disabled=!total;
 $('reviewFilterOption').textContent=`仅显示复核建议（${total}）`;
 $('analyzeShots').textContent=total?`复核建议 ${total}`:'智能复核';
 if(!total && $('reviewFilter').value==='review') $('reviewFilter').value='all';
}

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

async function analyzeShots() {
 if (state.busy || state.shots.length<2) return;
 state.busy=true;updateControls();
 const shots=sortShots(state.shots,'time','asc'), found=new Map();
 const canvas=document.createElement('canvas');
 canvas.width=canvas.height=REVIEW_SIDE;
 const context=canvas.getContext('2d',{willReadFrequently:true});
 let previous=null, skipped=0;
 try {
  for(const [i,shot] of shots.entries()) {
   if(i%2===0) {
    $('analyzeShots').textContent=`复核中 ${i+1}/${shots.length}`;
    await new Promise(resolve=>setTimeout(resolve,0));
   }
   if(previous&&matchesShotSource(shot.source,previous.source)&&shot.width===previous.width&&shot.height===previous.height) {
    try {
     const a=await reviewImage(previous,canvas,context),b=await reviewImage(shot,canvas,context);
     const result=compareReviewFrames(a,b);
     if(result)found.set(shot,{...result,previous});
    } catch {skipped++;}
   }
   previous=shot;
  }
  reviewFindings=new WeakMap(found);
  $('reviewFilter').value=found.size?'review':'all';
  toast((found.size?`已生成 ${found.size} 条复核建议`:'未发现需要标注的画面')+(skipped?`，${skipped} 组无法读取`:''));
 } finally {
  canvas.width=0;state.busy=false;updateReviewControls();renderGallery();
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
