const REVIEW_SIDE=96;

function reviewDifference(a,b,side,dx=0,dy=0) {
 const x0=Math.max(0,-dx), x1=Math.min(side,side-dx);
 const y0=Math.max(0,-dy), y1=Math.min(side,side-dy);
 let sum=0,changed=0,texture=0;
 for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++) {
  const i=(y*side+x)*4,j=((y+dy)*side+x+dx)*4;
  const delta=Math.max(Math.abs(a[i]-b[j]),Math.abs(a[i+1]-b[j+1]),Math.abs(a[i+2]-b[j+2]));
  sum+=delta;
  if(delta>18) changed++;
  if(x>x0) texture+=Math.abs(a[i]-a[i-4]);
  if(y>y0) texture+=Math.abs(a[i]-a[i-side*4]);
 }
 const count=(x1-x0)*(y1-y0);
 return {mean:sum/count,changed:changed/count,texture:texture/count};
}

function reviewLocalChange(a,b,side) {
 for(let y=0;y<side;y+=8) for(let x=0;x<side;x+=8) {
  let changed=0;
  for(let j=y;j<Math.min(side,y+8);j++) for(let i=x;i<Math.min(side,x+8);i++) {
   const p=(j*side+i)*4;
   if(Math.max(Math.abs(a[p]-b[p]),Math.abs(a[p+1]-b[p+1]),Math.abs(a[p+2]-b[p+2]))>18) changed++;
  }
  if(changed>=3)return true;
 }
 return false;
}

export function compareReviewFrames(a,b,side=REVIEW_SIDE) {
 const still=reviewDifference(a,b,side);
 if(still.mean<=2.5 && still.changed<=.015 && !reviewLocalChange(a,b,side)) return {type:'duplicate'};
 if(still.texture>4 && still.mean>12) {
  let best=null;
  for(const axis of ['y','x']) {
   for(let shift=Math.ceil(side*.16);shift<=Math.floor(side*.87);shift++) {
    for(const sign of [-1,1]) {
     const delta=sign*shift;
     const match=reviewDifference(a,b,side,axis==='x'?delta:0,axis==='y'?delta:0);
     if(match.texture<5 || match.mean>6 || match.changed>.09 || match.mean>still.mean*.35)continue;
     const score=match.mean+shift/side*2;
     if(!best||score<best.score) best={score,axis,shift};
    }
   }
  }
  if(best) {
   const overlap=Math.round((1-best.shift/side)*100);
   return {type:overlap<25?'gap':'scroll',axis:best.axis,overlap};
  }
 }
 if(still.mean>48 && still.changed>.55) return {type:'scene'};
 if(still.mean<18 && reviewLocalChange(a,b,side)) return {type:'changed'};
 return null;
}
