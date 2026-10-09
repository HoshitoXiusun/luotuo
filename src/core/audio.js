import {parseTime} from './shots.js';
export function audioRange(start,end,duration){
 const a=String(start).trim()===''?0:parseTime(start);
 const b=String(end).trim()===''?duration:parseTime(end);
 if(!Number.isFinite(duration)||duration<=0||![a,b].every(Number.isFinite)||a<0||b<=a||b>duration+.001||a>=duration)throw Error('请填写有效音频范围：起点 ≥ 0，终点 > 起点，且不超过音轨时长');
 return {start:a,end:Math.min(b,duration)};
}
export function pcm16(value){const v=Math.max(-1,Math.min(1,Number.isFinite(value)?value:0));return Math.round(v*(v<0?32768:32767))}
export async function encodeWav(buffer,range,onProgress=()=>{},shouldCancel=()=>false){
 const channels=buffer.numberOfChannels,rate=buffer.sampleRate;
 if(![1,2].includes(channels))throw Error('WAV 导出目前支持单声道或双声道，多声道请先转换');
 if(!Number.isInteger(rate)||rate<8000||rate>192000)throw Error('音轨采样率无效');
 const start=Math.floor(range.start*rate),end=Math.min(buffer.length,Math.ceil(range.end*rate)),frames=end-start;
 if(frames<1||start<0||frames*channels*2>128*1048576)throw Error('音频范围为空或输出超过 128MB，请缩短范围');
 const bytes=new Uint8Array(44+frames*channels*2),view=new DataView(bytes.buffer);
 const str=(at,s)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i))};
 str(0,'RIFF');view.setUint32(4,bytes.length-8,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,rate,true);view.setUint32(28,rate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,frames*channels*2,true);
 const data=Array.from({length:channels},(_,c)=>buffer.getChannelData(c));
 for(let offset=0;offset<frames;offset+=rate){if(shouldCancel())throw Error('已停止音轨导出');const stop=Math.min(frames,offset+rate);for(let frame=offset;frame<stop;frame++)for(let channel=0;channel<channels;channel++)view.setInt16(44+(frame*channels+channel)*2,pcm16(data[channel][start+frame]),true);onProgress(stop/frames);await new Promise(resolve=>setTimeout(resolve,0))}
 if(shouldCancel())throw Error('已停止音轨导出');return bytes;
}
