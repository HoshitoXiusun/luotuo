function updateBatchRecommendation(){
 const frame=$('batchMode').value==='frame';$('batchFPSField').hidden=!frame;if($('batchFPS').value!==$('fps').value)$('batchFPS').value=$('fps').value;
 $('applyBatchRecommendation').disabled=!state.ready||state.busy||state.shots.length>=200;$('batchFPS').disabled=state.busy;
 if(!state.ready){$('batchRecommendation').textContent='导入视频后，按全片时长推荐截取参数。';$('batchRecommendationBasis').textContent='推荐用于快速概览，可按需要自行调整。';return}
 const r=batchRecommendation(video.duration,200-state.shots.length);if(!r){$('batchRecommendation').textContent='图库已满，请先导出并减少截图。';return}
 $('batchRecommendation').textContent=frame?`推荐 ${r.frameRate} FPS，间隔 ${r.frameStep} 帧（约 ${r.interval} 秒）· 全片约 ${r.frameCount} 张`:`推荐间隔 ${r.interval} 秒 · 全片约 ${r.timeCount} 张`;
 $('batchRecommendationBasis').textContent=`依据全片 ${timeText(video.duration).slice(0,8)}、目标不超过 ${r.target} 张概览；剩余 ${200-state.shots.length} 张容量。`+(frame?'帧率仅为换算建议，不代表源视频真实帧率；需要真实帧序号时请填写源 FPS。':'不会自动更改已填写的参数或起止范围。');
}
$('applyBatchRecommendation').onclick=()=>{if(!state.ready||state.busy)return;const r=batchRecommendation(video.duration,200-state.shots.length);if(!r)return;if($('batchMode').value==='frame'){$('fps').value=r.frameRate;$('batchFPS').value=r.frameRate;$('batchStep').value=r.frameStep}else $('batchStep').value=r.interval;markDirty();estimateBatch()};
$('batchFPS').oninput=()=>{$('fps').value=$('batchFPS').value;markDirty();estimateBatch()};
state.updateBatchRecommendation=updateBatchRecommendation;
