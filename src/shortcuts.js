const playbackStorageKey='frameright.playback.v1';
const videoBookmarks=new Map();

function sourceBookmarkKey() {
 const source=state.source;
 return source?JSON.stringify([source.name,source.size,source.lastModified]):null;
}

function bookmarkTime() {
 const key=sourceBookmarkKey();
 return key===null?undefined:videoBookmarks.get(key);
}

function saveVideoBookmark() {
 if(!state.ready||state.busy||video.seeking)return;
 videoBookmarks.set(sourceBookmarkKey(),video.currentTime);
 updateShortcutControls();
 toast('视频书签已设为 '+timeText(video.currentTime));
}

function returnToBookmark() {
 if(!state.ready||state.busy)return;
 const time=bookmarkTime();
 if(time===undefined){toast('请先为当前视频设置书签');return}
 return navigate(time);
}

function changePlaybackSpeed(direction) {
 const speed=$('speed'),next=direction===0?[...speed.options].findIndex(option=>option.value==='1'):
  Math.max(0,Math.min(speed.options.length-1,speed.selectedIndex+direction));
 if(next<0)return;
 speed.selectedIndex=next;
 speed.onchange();
}

function updateShortcutControls() {
 const time=state.ready?bookmarkTime():undefined;
 $('bookmarkPosition').textContent=time===undefined?'当前视频未设置书签':'书签位置 '+timeText(time);
 $('setBookmark').disabled=!state.ready||state.busy;
 $('returnBookmark').disabled=time===undefined||state.busy;
}

function refreshShortcutLabels() {
 const {interval,keys}=state.playback;
 $('shortcutJumpSummary').textContent=`${keys.back.toUpperCase()} / ${keys.forward.toUpperCase()} 后退 / 快进 ${interval} 秒`;
 $('shortcutCaptureKey').textContent=keys.capture.toUpperCase();
 $('toolHint').textContent=['audio','compress','shortcuts'].includes(state.functionId)?
  '音轨导出 · 视频压缩 · 快捷键':$('shortcutJumpSummary').textContent;
}

function initPlaybackShortcuts() {
 try {state.playback=playbackPreferences(JSON.parse(localStorage.getItem(playbackStorageKey)));}
 catch {state.playback=defaultPlayback;}
 const grid=$('shortcutGrid'), inputs=new Map();
 for(const [action,label] of shortcutActions) {
  const field=document.createElement('label'),input=document.createElement('input');
  field.append(label,input);
  input.type='text';input.maxLength=1;input.autocomplete='off';input.spellcheck=false;
  input.onfocus=()=>input.select();
  input.setAttribute('aria-label',label+'快捷键');
  inputs.set(action,input);grid.append(field);
 }
 function show() {
  $('seekInterval').value=state.playback.interval;
  for(const [action,input] of inputs)input.value=state.playback.keys[action].toUpperCase();
  refreshShortcutLabels();
 }
 function apply(next) {
  state.playback=next;
  show();
  try {
   localStorage.setItem(playbackStorageKey,JSON.stringify(next));
   $('shortcutStatus').textContent='设置已保存到当前浏览器。';
  } catch {$('shortcutStatus').textContent='设置已应用，本次页面打开期间有效。';}
 }
 $('shortcutForm').onsubmit=event=>{
  event.preventDefault();
  try {
   apply(playbackPreferences({interval:$('seekInterval').value,keys:Object.fromEntries(
    [...inputs].map(([action,input])=>[action,input.value])
   )}));
  } catch(error) {$('shortcutStatus').textContent=error.message;}
 };
 $('resetShortcuts').onclick=()=>apply(defaultPlayback);
 $('setBookmark').onclick=saveVideoBookmark;
 $('returnBookmark').onclick=returnToBookmark;
 show();
}
