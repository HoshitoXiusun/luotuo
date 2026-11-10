// Overview presets are based on duration, never inferred source-video FPS.
export function batchRecommendation(duration,capacity=200){
 if(!Number.isFinite(duration)||duration<=0||!Number.isInteger(capacity)||capacity<0||capacity>200)throw Error('推荐参数无效');
 if(!capacity)return null;
 const target=Math.min(120,capacity),raw=duration/target,steps=[.1,.2,.5,1,2,3,5,10,15,20,30,60,120,180,300,600,900,1800,3600];
 const interval=steps.find(n=>n>=raw)??Math.ceil(raw/3600)*3600;
 const frameRate=duration<=60?30:duration<=600?25:duration<=3600?15:10,frameStep=Math.max(1,Math.ceil(interval*frameRate));
 return {interval,frameRate,frameStep,target,timeCount:Math.max(1,Math.ceil(duration/interval-1e-10)),frameCount:Math.floor((Math.ceil(duration*frameRate)-1)/frameStep)+1};
}
