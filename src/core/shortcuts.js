export const shortcutActions = [
 ['back','后退','a'], ['forward','快进','d'],
 ['slower','降低倍速','z'], ['faster','提高倍速','c'], ['normal','恢复 1 倍速','x'],
 ['bookmark','设为视频书签','s'], ['return','回到视频书签','w'], ['capture','截图','p']
];

export function playbackPreferences(value = {}) {
 const interval = Number(value.interval);
 if (!Number.isFinite(interval) || interval < .1 || interval > 3600) {
  throw Error('跳转间隔须为 0.1–3600 秒');
 }
 const keys = {}, used = new Set(['m']);
 for (const [action,label] of shortcutActions) {
  const key = String(value.keys?.[action] ?? '').trim().toLowerCase();
  if (!/^[a-z]$/.test(key)) throw Error(label+'须使用单个英文字母');
  if (used.has(key)) throw Error(key.toUpperCase()+' 已被使用（M 用于静音）');
  used.add(key);
  keys[action] = key;
 }
 return {interval,keys};
}

export const defaultPlayback = {
 interval:1.5,
 keys:Object.fromEntries(shortcutActions.map(([id,,key])=>[id,key]))
};
