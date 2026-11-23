/* Hydrography overlay: USGS National Hydrography Dataset, 1:100,000 flowlines/waterbodies.
   Uses map's existing lon/lat -> SVG projection. No hand-drawn waterways. */
(function(){
'use strict';
const checkbox=document.getElementById('showWaterways');
const group=document.getElementById('majorWaterways');
const status=document.getElementById('waterStatus');
if(!checkbox||!group||!status)return;
const ns='http://www.w3.org/2000/svg';
const source='https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer';
const bbox='-85.16,38.94,-83.55,40.45';
const rivers=[
 'Ohio River','Great Miami River','Little Miami River','Mad River','Stillwater River',
 'Whitewater River','East Fork Little Miami River','East Fork','Buck Creek',
 'Paint Creek','Todd Fork','Clear Creek','Twin Creek','Four Mile Creek',
 'Seven Mile Creek','East Fork Whitewater River','West Fork Whitewater River',
 'Massies Creek','Caesar Creek','North Fork Massies Creek','Mill Creek',
 'North Fork Little Miami River','South Fork Little Miami River'
];
const escapeSql=n=>n.replace(/'/g,"''");
const names=rivers.map(n=>"'"+escapeSql(n)+"'").join(',');
const controls=[
 {id:4,label:'rivers',where:"GNIS_NAME IN ("+names+") AND FCODE IN (46000,46006,55800)",fields:'OBJECTID,GNIS_NAME,FCODE'},
 {id:10,label:'lakes',where:"AREASQKM >= 0.6 AND FTYPE IN ('LakePond','Reservoir')",fields:'OBJECTID,GNIS_NAME,AREASQKM,FTYPE'}
];
const format=n=>Number(n).toFixed(1);
const point=coords=>{
 if(!Array.isArray(coords)||coords.length<2)return null;
 const x=(Number(coords[0])+85)*600+83,y=27710-683*Number(coords[1]);
 return Number.isFinite(x)&&Number.isFinite(y)?[x,y]:null;
};
function svg(tag,attrs,parent){
 const n=document.createElementNS(ns,tag);
 for(const [k,v] of Object.entries(attrs||{}))n.setAttribute(k,String(v));
 if(parent)parent.appendChild(n);
 return n;
}
const stamp=coords=>{
 let out='',prev=null;
 for(const p of coords||[]){
  const q=point(p);if(!q)continue;
  if(prev&&Math.hypot(q[0]-prev[0],q[1]-prev[1])<.25)continue;
  out+=(out?'L':'M')+format(q[0])+','+format(q[1]);prev=q;
 }
 return out;
};
const polygon=rings=>(rings||[]).map(r=>stamp(r)+(r.length?'Z':'')).join(' ');
function geometryPath(geometry){
 if(!geometry)return '';
 switch(geometry.type){
 case 'LineString':return stamp(geometry.coordinates);
 case 'MultiLineString':return (geometry.coordinates||[]).map(stamp).join(' ');
 case 'Polygon':return polygon(geometry.coordinates);
 case 'MultiPolygon':return (geometry.coordinates||[]).map(polygon).join(' ');
 default:return '';
 }
}
function paramsFor(cfg,offset){
 const params=new URLSearchParams({
  f:'geojson',where:cfg.where,geometry:bbox,geometryType:'esriGeometryEnvelope',
  inSR:'4326',spatialRel:'esriSpatialRelIntersects',outSR:'4326',
  outFields:cfg.fields,returnGeometry:'true',returnZ:'false',returnM:'false',
  resultOffset:String(offset),resultRecordCount:'800',orderByFields:'OBJECTID ASC'
 });
 return source+'/'+cfg.id+'/query?'+params.toString();
}
async function retrieve(cfg){
 let found=[],offset=0;
 // Cap pagination to avoid runaway data requests if service behavior changes.
 for(let page=0;page<8;page++){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),18000);
  let res;
  try{res=await fetch(paramsFor(cfg,offset),{signal:controller.signal,mode:'cors'});}
  finally{clearTimeout(timeout)}
  if(!res.ok)throw Error('USGS HTTP '+res.status);
  const json=await res.json();
  if(json.error)throw Error(json.error.message||'Hydrography service error');
  if(!Array.isArray(json.features))throw Error('Unexpected USGS GeoJSON response');
  found=found.concat(json.features);
  if(json.features.length<800&&!json.exceededTransferLimit)break;
  offset+=json.features.length;
  if(!json.features.length)break;
 }
 return found;
}
function addFeatures(features,kind){
 const frag=document.createDocumentFragment();
 let displayed=0;
 for(const f of features){
  const geometry=f.geometry,desc=f.properties||{},d=geometryPath(geometry);
  if(!d)continue;
  const water=svg('path',{d,class:kind==='lakes'?'hydro-lake':'hydro-river', 'fill-rule':'evenodd'},frag);
  if(desc.GNIS_NAME){svg('title',{},water).textContent=String(desc.GNIS_NAME)}
  displayed++;
 }
 group.appendChild(frag);
 return displayed;
}
let loaded=false,loading=false;
async function load(){
 if(loaded||loading)return;
 loading=true;status.textContent='Loading USGS rivers and lakes…';
 const outcomes=await Promise.allSettled(controls.map(retrieve));
 let count=0,notes=[];
 outcomes.forEach((result,i)=>{
  if(result.status==='fulfilled'){
   const countHere=addFeatures(result.value,controls[i].label);count+=countHere;
   notes.push(countHere+' '+controls[i].label+' segments');
  }else notes.push(controls[i].label+' unavailable');
 });
 loading=false;
 if(count){loaded=outcomes.every(o=>o.status==='fulfilled');status.textContent='Waterways: '+notes.join(' · ')+' (USGS NHD).';}
 else status.textContent='USGS waterways unavailable; try again later.';
 if(outcomes.some(o=>o.status==='rejected')){
  const errors=outcomes.filter(o=>o.status==='rejected').map(o=>o.reason?.message||'service error');
  status.title='Waterway layer could not fully load: '+errors.join('; ');
  // Clear partially loaded results on retry to prevent duplicates.
  if(!loaded)group.replaceChildren();
 }
}
checkbox.addEventListener('change',()=>{
 group.classList.toggle('hidden',!checkbox.checked);
 if(checkbox.checked&&!loaded)load();
});
group.classList.toggle('hidden',!checkbox.checked);
if(checkbox.checked)load();
})();
