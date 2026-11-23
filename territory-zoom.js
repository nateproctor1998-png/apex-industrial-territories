/* Click any Ohio territory (or its label) to zoom into it.
   Pure SVG viewBox navigation; leaves all underlying records, map layers,
   pins, Google Earth tools and facility selection handlers untouched. */
(function(){
'use strict';
const svg=document.querySelector('main.wrap svg[viewBox]');
const resetButton=document.getElementById('resetTerritoryZoom');
const outButton=document.getElementById('zoomTerritoryOut');
const locationLabel=document.getElementById('zoomTerritoryStatus');
const select=document.getElementById('territory');
if(!svg||!resetButton||!outButton||!locationLabel)return;
const original=svg.viewBox.baseVal;
const home={x:original.x,y:original.y,width:original.width,height:original.height};
const shapes=[...svg.querySelectorAll('path.territory[data-territory]')];
const badges=[...svg.querySelectorAll('g.territory-label')];
const names=[...new Set(shapes.map(p=>p.dataset.territory))];
const labelNames={
'Hamilton W':'Hamilton West','Hamilton E':'Hamilton East',
'Greene S':'Greene South','Greene N':'Greene North',
'Butler S':'Butler South','Butler N':'Butler North',
'Clark S':'Clark South','Clark N':'Clark North',
'Montgomery S':'Montgomery South','Montgomery N':'Montgomery North',
'Miami S':'Miami South','Miami N':'Miami North',
'Warren S':'Warren South','Warren N':'Warren North',
'Preble County':'Preble County','Darke':'Darke County',
'Clinton':'Clinton County','Clermont':'Clermont County'
};
let active='',frame=null;
function box(){const b=svg.viewBox.baseVal;return{x:b.x,y:b.y,width:b.width,height:b.height}}
function apply(b){svg.setAttribute('viewBox',[b.x,b.y,b.width,b.height].map(v=>Number(v).toFixed(3)).join(' '))}
function animate(target){
 if(frame!==null)cancelAnimationFrame(frame);
 const start=box(),beg=performance.now(),duration=310;
 function run(t){
  const p=Math.min(1,(t-beg)/duration),ease=1-Math.pow(1-p,3);
  apply({x:start.x+(target.x-start.x)*ease,y:start.y+(target.y-start.y)*ease,
   width:start.width+(target.width-start.width)*ease,height:start.height+(target.height-start.height)*ease});
  frame=p<1?requestAnimationFrame(run):null;
 }
 frame=requestAnimationFrame(run);
}
function setCurrent(name){
 active=name||'';
 locationLabel.textContent=active?'Viewing: '+active:'Viewing: All territories';
 resetButton.disabled=!active;
 outButton.disabled=!active&&box().width>=home.width-1;
 shapes.forEach(p=>p.classList.toggle('territory-zoom-active',p.dataset.territory===active&&!!active));
 badges.forEach((b,i)=>b.classList.toggle('territory-zoom-active',labelNames[String(b.getAttribute('aria-label')||'').split(' · ')[0]]===active&&!!active));
}
function viewFit(name){
 const matches=shapes.filter(p=>p.dataset.territory===name);
 if(!matches.length)return;
 const bounds=matches.map(p=>{try{return p.getBBox()}catch(e){return null}}).filter(b=>b&&b.width>0&&b.height>0);
 if(!bounds.length)return;
 let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
 for(const b of bounds){left=Math.min(left,b.x);right=Math.max(right,b.x+b.width);top=Math.min(top,b.y);bottom=Math.max(bottom,b.y+b.height)}
 const ratio=home.width/home.height,pad=28;
 let w=Math.max(right-left+2*pad,90),h=Math.max(bottom-top+2*pad,90);
 if(w/h<ratio)w=h*ratio;else h=w/ratio;
 w=Math.min(w,home.width);h=Math.min(h,home.height);
 let x=Math.max(home.x,Math.min(home.x+home.width-w,(left+right-w)/2));
 let y=Math.max(home.y,Math.min(home.y+home.height-h,(top+bottom-h)/2));
 animate({x,y,width:w,height:h});
 setCurrent(name);
}
function reset(){animate(home);setCurrent('')}
shapes.forEach(p=>{
 p.setAttribute('tabindex','0');p.setAttribute('role','button');
 p.setAttribute('aria-label','Zoom into '+p.dataset.territory+' territory');
 p.addEventListener('click',e=>{e.stopPropagation();viewFit(p.dataset.territory)});
 p.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();viewFit(p.dataset.territory)}});
});
badges.forEach(b=>{
 const short=String(b.getAttribute('aria-label')||'').split(' · ')[0];
 const name=labelNames[short]||names.find(n=>n.toLowerCase().startsWith(short.toLowerCase()))||'';
 if(!name)return;
 b.classList.add('territory-zoom-clickable');b.setAttribute('tabindex','0');
 b.setAttribute('role','button');b.setAttribute('aria-label','Zoom into '+name+' territory');
 b.addEventListener('click',e=>{e.stopPropagation();viewFit(name)});
 b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();viewFit(name)}});
});
resetButton.addEventListener('click',reset);
outButton.addEventListener('click',()=>{
 const b=box();if(b.width>=home.width-.1){reset();return}
 const newWidth=Math.min(home.width,b.width*1.8),newHeight=Math.min(home.height,b.height*1.8);
 const midX=b.x+b.width/2,midY=b.y+b.height/2;
 const x=Math.max(home.x,Math.min(home.x+home.width-newWidth,midX-newWidth/2));
 const y=Math.max(home.y,Math.min(home.y+home.height-newHeight,midY-newHeight/2));
 animate({x,y,width:newWidth,height:newHeight});
 if(newWidth>=home.width-1) setCurrent('');
 else {active='';setCurrent('');outButton.disabled=false;locationLabel.textContent='Viewing: Custom zoom'}
});
if(select)select.addEventListener('change',()=>{if(select.value&&names.includes(select.value))viewFit(select.value);else reset()});
setCurrent('');
})();
