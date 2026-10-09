// Keep the media element and all audio controls in sync. Raising volume unmutes;
// unmuting from zero restores the last audible level instead of remaining silent.
let lastAudibleVolume=.8;
function enableAudioTrack(){const tracks=video.audioTracks;if(tracks?.length&&!Array.from(tracks).some(track=>track.enabled))tracks[0].enabled=true}
function syncAudioControls(){
 if(video.volume>0)lastAudibleVolume=video.volume;
 $('muted').checked=video.muted;$('volume').value=Math.round(video.volume*100);$('volumeValue').textContent=Math.round(video.volume*100)+'%';
 $('audioStateLabel').textContent=video.muted||video.volume===0?'已静音':'声音已开启';
}
function setPlaybackMuted(muted){
 if(!muted){video.defaultMuted=false;video.removeAttribute('muted');if(video.volume===0)video.volume=lastAudibleVolume;enableAudioTrack()}
 video.muted=muted;syncAudioControls();
}
function resetPlaybackAudio(){video.defaultMuted=false;video.removeAttribute('muted');video.volume=.8;video.muted=false;lastAudibleVolume=.8;enableAudioTrack();syncAudioControls()}
function updateAudioControls(){for(const id of ['audioExport','audioSetStart','audioSetEnd','restoreSound'])$(id).disabled=!state.ready||state.busy;for(const id of ['audioStart','audioEnd','pauseAfterCapture'])$(id).disabled=state.busy;$('audioCancel').hidden=!state.audioExporting;syncAudioControls()}
$('volume').oninput=()=>{video.volume=Number($('volume').value)/100;if(video.volume>0)setPlaybackMuted(false);else syncAudioControls()};
video.addEventListener('volumechange',syncAudioControls);
video.addEventListener('loadstart',resetPlaybackAudio);
video.addEventListener('loadeddata',()=>{$('audioStart').value='';$('audioEnd').value='';$('audioStatus').textContent='起止都留空时导出整段音频。';video.playbackRate=Number($('speed').value);enableAudioTrack();syncAudioControls()});
$('restoreSound').onclick=async()=>{resetPlaybackAudio();try{if(video.paused)await video.play();toast('已开启声音，音量 80%')}catch(e){toast('声音已开启，请点击播放：'+e.message)}updateControls()};
for(const [id,target]of [['audioSetStart','audioStart'],['audioSetEnd','audioEnd']])$(id).onclick=()=>{$(target).value=video.currentTime.toFixed(3)};
async function exportAudio(){
 if(!state.ready||!state.sourceFile||state.busy)return;
 const file=state.sourceFile;
 if(video.duration>300||file.size>100*1048576){toast('音轨导出限 5 分钟、100MB 内的源视频；播放器和截图不受此限制');return}
 const startText=$('audioStart').value,endText=$('audioEnd').value;
 try{audioRange(startText,endText,video.duration)}catch(e){toast(e.message);return}
 state.busy=true;state.audioExporting=true;state.audioCancel=false;updateControls();$('audioProgress').hidden=false;$('audioProgress').value=5;$('audioStatus').textContent='正在本地读取并解码音轨…';let context=null;
 try{const AudioCtor=window.AudioContext||window.webkitAudioContext;if(!AudioCtor)throw Error('此浏览器不支持本地音轨导出，请使用 Chrome / Edge');context=new AudioCtor({sampleRate:44100});const source=await file.arrayBuffer();if(state.audioCancel)throw Error('已停止音轨导出');let buffer;try{buffer=await context.decodeAudioData(source)}catch{if(state.audioCancel)throw Error('已停止音轨导出');throw Error('此视频没有可解码的音轨，或音频编码不受浏览器支持')}
 if(state.audioCancel)throw Error('已停止音轨导出');const range=audioRange(startText,endText,buffer.duration);$('audioProgress').value=35;$('audioStatus').textContent='正在生成原始音量的 WAV…';const bytes=await encodeWav(buffer,range,n=>$('audioProgress').value=35+n*60,()=>state.audioCancel);if(state.audioCancel)throw Error('已停止音轨导出');const name=safeName(file.name.replace(/\.[^.]+$/,''))+'_音轨_'+timeText(range.start).replace(/:/g,'-')+'_'+timeText(range.end).replace(/:/g,'-')+'.wav';const ok=await save(new Blob([bytes],{type:'audio/wav'}),name);$('audioProgress').value=100;$('audioStatus').textContent=ok?`已导出 ${(range.end-range.start).toFixed(2)} 秒音频 · ${buffer.numberOfChannels} 声道 · ${buffer.sampleRate} Hz`:'保存已取消';
 }catch(e){$('audioStatus').textContent=e.message;toast(e.message)}finally{if(context)try{await context.close()}catch{}state.busy=false;state.audioExporting=false;$('audioProgress').hidden=true;updateControls()}
}
$('audioExport').onclick=exportAudio;$('audioCancel').onclick=()=>{state.audioCancel=true;$('audioStatus').textContent='正在停止；解码中的任务会在解码返回后退出…'};
