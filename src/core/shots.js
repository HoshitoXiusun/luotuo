// Display order and display numbers share one comparator; ids never change.
export function sortShots(shots,mode='time'){
 const compareSource=(a,b)=>String(a?.name||'').localeCompare(String(b?.name||''),'zh-CN',{numeric:true})||(a?.size||0)-(b?.size||0)||(a?.lastModified||0)-(b?.lastModified||0);
 return [...shots].sort(mode==='capture'?(a,b)=>b.id-a.id:(a,b)=>compareSource(a.source,b.source)||(a.time||0)-(b.time||0)||a.id-b.id);
}
export function assignShotNumbers(shots,mode='time'){
 sortShots(shots,mode).forEach((shot,index)=>shot.number=index+1);
 return shots;
}
export function parseTime(value){
 const t=String(value).trim();
 if(/^\d+(\.\d+)?$/.test(t))return Number(t);
 if(!/^\d+:\d{1,2}:\d{1,2}(\.\d{1,3})?$/.test(t))return NaN;
 const a=t.split(':').map(Number);
 if(a[1]>=60||a[2]>=60)return NaN;
 return a[0]*3600+a[1]*60+a[2];
}
export function createCapturePlan({mode,start,end,step,frameRate,duration,capacity=200}){
 if(!Number.isFinite(frameRate)||frameRate<1||frameRate>240)throw Error('步进帧率须在 1–240 之间');
 if(!['time','frame'].includes(mode))throw Error('截图模式无效');
 if(String(step).trim()==='')throw Error('请填写间隔');
 if(!Number.isFinite(duration)||duration<=0)throw Error('视频时长无效');
 const emptyStart=String(start??'').trim()==='',emptyEnd=String(end??'').trim()==='';
 const factor=mode==='frame'?frameRate:1;
 const a=emptyStart?0:(mode==='frame'?Number(start):parseTime(start));
 const b=emptyEnd?(mode==='frame'?Math.ceil(duration*frameRate)-1:duration):(mode==='frame'?Number(end):parseTime(end));
 const delta=Number(step);
 if(![a,b,delta].every(Number.isFinite)||a<0||b<a||delta<=0)throw Error('请填写有效范围：起点 ≥ 0，终点 ≥ 起点，间隔 > 0');
 if(mode==='frame'&&![a,b,delta].every(Number.isInteger))throw Error('帧范围和帧间隔必须为整数');
 if(a/factor>=duration||(!emptyEnd&&b/factor>=duration))throw Error('终点须小于视频时长；最后位置请略向前调整');
 const quotient=(b-a)/delta;
 const count=emptyEnd&&mode==='time'?Math.max(1,Math.ceil(quotient-1e-10)):Math.floor(quotient+1e-8)+1;
 if(count<1)throw Error('该范围内没有可截取的画面');
 if(count>200||count>capacity)throw Error(`预计 ${count} 张，超过图库剩余容量 ${capacity} 张；请缩小范围或增大间隔`);
 return {count,times:Array.from({length:count},(_,i)=>(a+i*delta)/factor)};
}
