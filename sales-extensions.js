/* Apex 2026 territory enhancements. Runs after existing inline map controller. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const records=allRows, key='apex-expansion-inbox-v1';
let inbox=[];try{inbox=JSON.parse(localStorage.getItem(key)||'[]')}catch(e){}
if(!Array.isArray(inbox))inbox=[];
const persistInbox=()=>{try{localStorage.setItem(key,JSON.stringify(inbox))}catch(e){alert('Browser storage is full; export data before proceeding.')}};
const clean=v=>String(v||'').trim();
const normal=v=>clean(v).toLowerCase().replace(/[^a-z0-9]/g,'');
const extStatus=(id,msg)=>{if($(id))$(id).textContent=msg};
const scores={Manufacturing:22,Distribution:25,Food:24,Aerospace:24,Chemical:22,Medical:18,Other:8,Unclassified:0};
function scoreFacility(i){
 const r=recordFor(i),c=facilityCategory(r.type),sq=Number(r.buildingSqft)||0;
 const types=scores[c]||0;
 const size=sq>=150000?25:sq>=75000?20:sq>=30000?14:sq>=10000?8:sq>0?4:0;
 const tags=Math.min(24,(r.flooringTags||[]).length*8);
 const stage={'Not Contacted':0,'Contacted':8,'Follow-Up':12,'Active Opportunity':20,'Not Interested':0}[recordStatus(i)]||0;
 const due=(r.nextFollowup&&r.nextFollowup<=dateISO()&&recordStatus(i)!=='Not Interested')?6:0;
 const score=Math.min(100,types+size+tags+stage+due);
 return {score,parts:{types,size,tags,stage,due},data:!!(r.type||sq||(r.flooringTags||[]).length||r.salesStatus)};
}
function refreshExtensionRow(i){
 const row=records[i],o=scoreFacility(i);
 const cell=row.querySelector('.upg-score');
 if(cell){cell.textContent=o.data?String(o.score):'—';cell.title='Sales-priority estimate; not a verified floor condition or dollar estimate';cell.className='upg-score'+(o.score>=70?' high':o.score>=40?' medium':'');}
 const r=recordFor(i),pin=facilityPins[i];
 if(pin&&r.locationVerified&&Number.isFinite(Number(r.latitude))&&Number.isFinite(Number(r.longitude))){
  const p=projectedPoint([Number(r.longitude),Number(r.latitude)]);
  if(p.every(Number.isFinite)){pin.setAttribute('cx',p[0].toFixed(1));pin.setAttribute('cy',p[1].toFixed(1));pin.dataset.location='verified';}
 }else if(pin){
  pin.setAttribute('cx',pin.dataset.defaultCx);pin.setAttribute('cy',pin.dataset.defaultCy);delete pin.dataset.location;
 }
}
facilityPins.forEach(p=>{p.dataset.defaultCx=p.getAttribute('cx');p.dataset.defaultCy=p.getAttribute('cy')});
function refreshExtension(){records.forEach((r,i)=>refreshExtensionRow(i));refreshReminders();refreshInbox()}
function updateScoreCard(i){
 const o=scoreFacility(i),r=recordFor(i);
 extStatus('scoreExplainer',(o.data?o.score+' / 100':'Not scored yet')+' · type '+o.parts.types+' + size '+o.parts.size+' + tags '+o.parts.tags+' + sales stage '+o.parts.stage+' + follow-up '+o.parts.due+'. Based on entered data only; building size is not floor coating area.');
 const verified=!!r.locationVerified;
 extStatus('geoVerification',verified?'Coordinates manually marked verified; location moved to the map.':'Pin remains approximate until coordinates are saved and verified.');
}
const oldSelect=selectFacility;
selectFacility=function(i){
 oldSelect(i);const r=recordFor(i);
 $('dBuildingSqft').value=r.buildingSqft||'';
 $('dBuildingSource').value=r.buildingSource||'';
 $('dGeoLat').value=r.latitude??'';
 $('dGeoLon').value=r.longitude??'';
 $('dGeoVerified').checked=!!r.locationVerified;
 $('coordinateSuggestions').replaceChildren();
 updateScoreCard(i);
};
$('saveDetail').addEventListener('click',()=>{
 if(selected===null)return;
 const o=overrides[selected]||{},size=clean($('dBuildingSqft').value);
 const lat=clean($('dGeoLat').value),lon=clean($('dGeoLon').value),verified=$('dGeoVerified').checked;
 if(size&&(isNaN(Number(size))||Number(size)<0||Number(size)>100000000)){extStatus('saveStatus','Invalid building size; use a nonnegative number.');return}
 if((lat||lon)&&(!lat||!lon||isNaN(Number(lat))||isNaN(Number(lon))||Number(lat)<38||Number(lat)>42||Number(lon)<-86||Number(lon)>-82)){extStatus('saveStatus','Invalid coordinates. Enter both Ohio latitude and longitude values.');return}
 // Coordinates may be left as draft but must be explicitly confirmed before relocating pins.
 o.buildingSqft=size?Number(size):null;o.buildingSource=clean($('dBuildingSource').value);
 o.latitude=lat?Number(lat):null;o.longitude=lon?Number(lon):null;
 o.locationVerified=!!(verified&&lat&&lon);
 overrides[selected]=o;
 if(persistSales()){refreshExtensionRow(selected);updateScoreCard(selected);extStatus('saveStatus','Saved contact, sales, size, and location details in this browser.')}
});
$('locateOSM').addEventListener('click',()=>{
 if(selected===null)return;
 const address=recordFor(selected).address;
 window.open('https://www.openstreetmap.org/search?query='+encodeURIComponent(address+', Ohio, USA'),'_blank','noopener,noreferrer');
 extStatus('geoVerification','Use OpenStreetMap to verify the exact building, then enter its coordinates here and check Verified. Search results are not automatically assumed correct.');
});
// One address lookup at a time. User must verify any returned location.
let lastCoordinateLookup=0;
$('suggestCoordinates').addEventListener('click',async()=>{
 if(selected===null)return;
 const out=$('coordinateSuggestions');out.replaceChildren();
 if(Date.now()-lastCoordinateLookup<2000){extStatus('geoVerification','Please allow at least two seconds between searches.');return}
 lastCoordinateLookup=Date.now();
 const button=$('suggestCoordinates'),index=selected;
 button.disabled=true;
 extStatus('geoVerification','Searching for possible locations…');
 try{
  const params=new URLSearchParams({q:recordFor(index).address+', Ohio, USA',format:'jsonv2',countrycodes:'us',limit:'3'});
  const response=await fetch('https://nominatim.openstreetmap.org/search?'+params.toString());
  if(!response.ok)throw Error('Geocoding returned '+response.status);
  const results=await response.json();
  if(index!==selected)return;
  if(!Array.isArray(results)||!results.length){extStatus('geoVerification','No matches found. Use manual map lookup.');return}
  extStatus('geoVerification','Possible matches from OpenStreetMap contributors. Verify the exact building before saving.');
  for(const result of results){
   const lat=Number(result.lat),lon=Number(result.lon);
   if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<38||lat>42||lon < -86||lon > -82)continue;
   const line=document.createElement('div'),name=document.createElement('div'),button=document.createElement('button');
   line.className='upg-lead';name.textContent=result.display_name||lat+', '+lon;
   button.type='button';button.textContent='Use suggestion';
   button.addEventListener('click',()=>{
    if(selected!==index)return;
    $('dGeoLat').value=lat.toFixed(7);$('dGeoLon').value=lon.toFixed(7);$('dGeoVerified').checked=false;
    extStatus('geoVerification','Coordinates proposed but not verified. Check exact facility location, tick Verified, then Save.');
   });
   line.append(name,button);out.appendChild(line);
  }
 }catch(error){extStatus('geoVerification','Lookup unavailable: '+error.message+'. Use manual OpenStreetMap search.')}
 finally{button.disabled=false}
});
// Route approximate optimization: only confirmed geographic coordinates, actual streets are handled by Google Maps.
function geodistance(a,b){
 const la=a[0]*Math.PI/180,lb=b[0]*Math.PI/180,dl=(b[0]-a[0])*Math.PI/180,doff=(b[1]-a[1])*Math.PI/180;
 return 6371*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dl/2)**2+Math.cos(la)*Math.cos(lb)*Math.sin(doff/2)**2)));
}
function optimizeStops(){
 if(visitRoute.length<3){extStatus('routeMessage','Add at least three stops to optimize.');return}
 const coord=i=>{const r=recordFor(i);return r.locationVerified&&Number.isFinite(Number(r.latitude))&&Number.isFinite(Number(r.longitude))?[Number(r.latitude),Number(r.longitude)]:null};
 if(visitRoute.some(i=>!coord(i))){extStatus('routeMessage','Order unchanged. Verify coordinates for every selected stop before optimizing.');return}
 const start=visitRoute[0];let left=visitRoute.slice(1),ordered=[start];
 while(left.length){const p=coord(ordered[ordered.length-1]);left.sort((a,b)=>geodistance(p,coord(a))-geodistance(p,coord(b)));ordered.push(left.shift())}
 // 2-opt improvement for an open route; preserve first stop and let Google Maps compute road directions.
 const routeLen=arr=>arr.slice(1).reduce((sum,v,j)=>sum+geodistance(coord(arr[j]),coord(v)),0);
 for(let iter=0;iter<12;iter++){let improved=false;for(let i=1;i<ordered.length-1;i++)for(let j=i+1;j<ordered.length;j++){
  const candidate=ordered.slice(0,i).concat(ordered.slice(i,j+1).reverse(),ordered.slice(j));
  if(routeLen(candidate)+.001<routeLen(ordered)){ordered=candidate;improved=true;}
 }if(!improved)break}
 visitRoute=ordered;persistRoute();refreshAllSalesRows();renderRoute();
 extStatus('routeMessage','Stops reordered by approximate straight-line distances from the first selected stop. Google Maps provides the actual driving roads and times; this is not a driving-time optimum.');
}
$('optimizeRoute').addEventListener('click',optimizeStops);
function dueFacilities(){
 return records.map((row,i)=>({i,r:recordFor(i)})).filter(({r,i})=>r.nextFollowup&&r.nextFollowup<=dateISO()&&recordStatus(i)!=='Not Interested')
 .sort((a,b)=>a.r.nextFollowup.localeCompare(b.r.nextFollowup));
}
function refreshReminders(){
 const due=dueFacilities(),out=$('upgReminders');out.replaceChildren();
 extStatus('upgDueCount',due.length+' due / overdue');
 if(!due.length){out.textContent='No overdue or due-today follow-ups.';return}
 for(const {i,r} of due.slice(0,100)){
  const line=document.createElement('div');line.className='upg-lead';
  const txt=document.createElement('div');const strong=document.createElement('strong');strong.textContent=r.company;
  const sub=document.createElement('small');sub.textContent=r.nextFollowup+' · '+records[i].dataset.territory;
  txt.append(strong,sub);
  const btn=document.createElement('button');btn.type='button';btn.textContent='Open';btn.addEventListener('click',()=>selectFacility(i));
  line.append(txt,btn);out.appendChild(line);
 }
}
$('refreshFollowups').addEventListener('click',refreshReminders);
$('enableFollowupNotifications').addEventListener('click',async()=>{
 if(!('Notification' in window)){extStatus('followupNotice','Desktop notifications are not supported in this browser.');return}
 try{const permission=await Notification.requestPermission();extStatus('followupNotice',permission==='granted'?'Notifications enabled while this map is open (not background reminders).':'Notifications were not enabled.')}
 catch(e){extStatus('followupNotice','Unable to enable notifications: '+e.message)}
});
let lastNoticeKey='';
function notifyFollowups(){
 if(!('Notification' in window)||Notification.permission!=='granted'||document.hidden)return;
 const due=dueFacilities(),k=dateISO()+'|'+due.map(x=>x.i).join(',');
 if(due.length&&k!==lastNoticeKey){lastNoticeKey=k;try{new Notification('Apex: '+due.length+' follow-up(s) due',{body:'Open the Follow-up center in your territory map.'})}catch(e){}}
}
setInterval(()=>{refreshReminders();notifyFollowups()},60000);
function csvParse(text){
 const out=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++}else if(c==='"')quoted=false;else field+=c}
  else if(c==='"')quoted=true;else if(c===','){row.push(field);field=''}else if(c==='\n'){row.push(field.replace(/\r$/,''));out.push(row);row=[];field=''}else field+=c;
 }if(field||row.length){row.push(field);out.push(row)}return out;
}
function leadKey(l){return normal(l.company)+'|'+normal(l.address||l.city)}
function existingLeadKeys(){return new Set(records.map((_,i)=>leadKey(recordFor(i))))}
$('importDiscoveries').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 if(file.size>2000000){extStatus('discoveryStatus','File too large (2 MB max).');return}
 try{
 const text=await file.text();let data;
 if(file.name.toLowerCase().endsWith('.json')){
  const obj=JSON.parse(text);data=Array.isArray(obj)?obj:Array.isArray(obj.leads)?obj.leads:[];
 }else{
  const rows=csvParse(text),headers=(rows.shift()||[]).map(x=>normal(x));
  data=rows.map(row=>Object.fromEntries(headers.map((k,j)=>[k,row[j]||''])));
 }
 const existing=existingLeadKeys(),known=new Set(inbox.map(leadKey));let added=0,skipped=0;
 const pick=(r,...names)=>{for(const n of names)if(r[n]!=null&&clean(r[n]))return clean(r[n]);return ''};
 for(const raw of data.slice(0,2000)){
  const r=Object.fromEntries(Object.entries(raw||{}).map(([k,v])=>[normal(k),v]));
  const company=pick(r,'company','companyname','facility','name');
  const address=pick(r,'address','physicaladdress','facilityaddress');
  const city=pick(r,'city','location','town');
  if(!company||(!address&&!city)){skipped++;continue}
  const lead={company,address,city,type:pick(r,'type','facilitytype','industry'),event:pick(r,'event','announcement','project','description'),source:pick(r,'source','url','link'),date:pick(r,'date','announced','announcementdate')||dateISO(),reviewed:false};
  const k=leadKey(lead);
  if(existing.has(k)||known.has(k)){skipped++;continue}
  inbox.push(lead);known.add(k);added++;
 }
 persistInbox();refreshInbox();
 extStatus('discoveryStatus',added+' new discoveries imported; '+skipped+' skipped (duplicates or missing company/location). Review each lead before adding it to your main map.');
 }catch(err){extStatus('discoveryStatus','Import failed: '+err.message)}finally{e.target.value=''}
});
function refreshInbox(){
 const out=$('discoveryInbox');out.replaceChildren();
 const pending=inbox.filter(l=>!l.reviewed);extStatus('discoveryCounter',pending.length+' pending review');
 if(!pending.length){out.textContent='No pending discoveries. Import a CSV or JSON file from your daily discovery report.';return}
 pending.slice(0,150).forEach(lead=>{
  const row=document.createElement('div');row.className='upg-lead';
  const txt=document.createElement('div'),name=document.createElement('strong'),info=document.createElement('small'),event=document.createElement('small');
  name.textContent=lead.company;info.textContent=[lead.address||lead.city,lead.date].filter(Boolean).join(' · ');
  event.textContent=lead.event||lead.type||'Facility discovery — verify before contacting';
  txt.append(name,info,event);
  if(/^https:\/\//i.test(lead.source||'')){const a=document.createElement('a');a.href=lead.source;a.textContent='Source';a.target='_blank';a.rel='noopener noreferrer';a.style.color='#9cd5ff';txt.appendChild(a)}
  const b=document.createElement('button');b.type='button';b.textContent='Reviewed';b.addEventListener('click',()=>{lead.reviewed=true;persistInbox();refreshInbox()});
  row.append(txt,b);out.appendChild(row);
 });
}
$('exportDiscoveries').addEventListener('click',()=>{
 const lines=['Company,Address,City,Type,Announcement,Source,Date,Reviewed'];
 const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 for(const l of inbox)lines.push([l.company,l.address,l.city,l.type,l.event,l.source,l.date,l.reviewed].map(quote).join(','));
 const blob=new Blob([lines.join('\r\n')],{type:'text/csv'}),u=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=u;a.download='apex-discovery-inbox.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),3000);
});
// Extend existing CSV without losing contacts or existing visits.
const oldExport=$('exportContacts');const newExport=oldExport.cloneNode(true);oldExport.replaceWith(newExport);
newExport.addEventListener('click',()=>{
 const hdr=['Company Name','Type of facility','Physical address','Point of contact','Contact title','Phone','Email','Territory','Facility record status','Contact status','Last contact','Next follow-up','Flooring opportunities','Notes','Interaction history','Building size SF','Building size source','Latitude','Longitude','Verified coordinates','Priority score'];
 const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"',lines=[hdr.map(quote).join(',')];
 records.forEach((row,i)=>{const r=recordFor(i);
  lines.push([r.company,r.type,r.address,r.contact,r.title,r.phone,r.email,row.cells[7].textContent,row.cells[8].textContent,recordStatus(i),r.lastVisit,r.nextFollowup,(r.flooringTags||[]).join('; '),r.notes,(r.activities||[]).map(a=>a.date+' '+a.type+' '+(a.note||'')).join(' | '),r.buildingSqft,r.buildingSource,r.latitude,r.longitude,r.locationVerified?'yes':'no',scoreFacility(i).score].map(quote).join(','));
 });
 const blob=new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='apex-territory-full-backup.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
});
// Optional Supabase: authenticated per-user data with RLS, never a service-role key.
let cloud=null,cloudUser=null,remoteUpdated=null;
const configKey='apex-cloud-configuration-v1',lastRemoteKey='apex-cloud-last-remote-v1';
let conf={};try{conf=JSON.parse(localStorage.getItem(configKey)||'{}')}catch(e){}
$('cloudProject').value=conf.url||'';$('cloudAnon').value=conf.anon||'';
function cloudState(message){extStatus('cloudStatus',message)}
async function cloudInit(){
 const url=$('cloudProject').value.trim().replace(/\/$/,'');
 const anon=$('cloudAnon').value.trim();
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)||!anon){cloudState('Enter an HTTPS Supabase project URL and its public publishable/anon key. Never use a service_role or secret key.');return false}
 if(anon.startsWith('sb_secret_')){cloudState('Secret keys must never be entered in a browser. Use the publishable key.');return false}
 if(!window.supabase){
  cloudState('Loading Supabase authentication library…');
  await new Promise((resolve,reject)=>{const sc=document.createElement('script');sc.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';sc.onload=resolve;sc.onerror=()=>reject(Error('Unable to load the authentication library'));document.head.appendChild(sc)});
 }
 cloud=window.supabase.createClient(url,anon,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 try{localStorage.setItem(configKey,JSON.stringify({url,anon}))}catch(e){}
 const {data,error}=await cloud.auth.getUser();cloudUser=error?null:data.user;
 cloudState(cloudUser?'Signed in as '+cloudUser.email+'. Use Upload or Download to sync.':'Cloud configured. Sign in using the email link.');
 $('cloudLogin').disabled=!!cloudUser;$('cloudLogout').disabled=!cloudUser;$('cloudUpload').disabled=!cloudUser;$('cloudDownload').disabled=!cloudUser;
 return true;
}
$('cloudConnect').addEventListener('click',async()=>{try{await cloudInit()}catch(e){cloudState('Cloud setup failed: '+e.message)}});
$('cloudLogin').addEventListener('click',async()=>{
 try{if(!cloud&&!(await cloudInit()))return;
 const email=$('cloudEmail').value.trim();if(!/^\S+@\S+\.\S+$/.test(email)){cloudState('Enter a valid email address.');return}
 const {error}=await cloud.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});
 cloudState(error?'Sign-in failed: '+error.message:'Check your email for a sign-in link. Return to this map after using it.');
 }catch(e){cloudState('Sign-in error: '+e.message)}
});
$('cloudLogout').addEventListener('click',async()=>{if(!cloud)return;await cloud.auth.signOut();cloudUser=null;cloudState('Signed out. Your browser data is unchanged.');$('cloudUpload').disabled=true;$('cloudDownload').disabled=true;$('cloudLogout').disabled=true;$('cloudLogin').disabled=false});
function cloudPayload(){return {version:1,overrides,visitRoute,routeOrigin:$('routeOrigin').value,inbox,exportedAt:new Date().toISOString()}}
async function remoteData(){
 if(!cloudUser)throw Error('Sign in first');
 const {data,error}=await cloud.from('apex_maps').select('payload,updated_at').eq('user_id',cloudUser.id).maybeSingle();
 if(error)throw error;return data;
}
$('cloudUpload').addEventListener('click',async()=>{
 try{
 const current=await remoteData();const prior=localStorage.getItem(lastRemoteKey);
 if(current&&current.updated_at!==prior&&!confirm('Cloud data may contain changes from another device. Upload will replace the cloud copy. Continue?'))return;
 const now=new Date().toISOString();
 const {error}=await cloud.from('apex_maps').upsert({user_id:cloudUser.id,payload:cloudPayload(),updated_at:now},{onConflict:'user_id'});
 if(error)throw error;localStorage.setItem(lastRemoteKey,now);cloudState('Upload completed. Cloud copy saved for '+cloudUser.email+'.');
 }catch(e){cloudState('Upload failed: '+e.message)}
});
$('cloudDownload').addEventListener('click',async()=>{
 try{
 const row=await remoteData();if(!row||!row.payload){cloudState('No cloud backup found for this account.');return}
 if(!confirm('Download will replace your current browser edits. A local backup will be created first. Continue?'))return;
 const backup=JSON.stringify(cloudPayload());
 localStorage.setItem('apex-pre-cloud-restore-'+Date.now(),backup);
 const p=row.payload;
 if(!p.overrides||typeof p.overrides!=='object'||Array.isArray(p.overrides))throw Error('Invalid cloud backup format');
 overrides=p.overrides;localStorage.setItem(storageKey,JSON.stringify(overrides));
 if(Array.isArray(p.visitRoute))localStorage.setItem(routeKey,JSON.stringify(p.visitRoute));
 if(typeof p.routeOrigin==='string')localStorage.setItem(originKey,p.routeOrigin);
 if(Array.isArray(p.inbox))localStorage.setItem(key,JSON.stringify(p.inbox));
 localStorage.setItem(lastRemoteKey,row.updated_at);
 cloudState('Downloaded and backed up prior browser data. Reloading map…');location.reload();
 }catch(e){cloudState('Download failed: '+e.message)}
});
$('downloadOfflineBackup').addEventListener('click',()=>{
 const blob=new Blob([JSON.stringify(cloudPayload(),null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=u;a.download='apex-private-browser-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),3000);
});
const existingRefresh=refreshSalesRow;
refreshSalesRow=function(i){existingRefresh(i);refreshExtensionRow(i)};
refreshExtension();
if(conf.url&&conf.anon)cloudInit().catch(e=>cloudState('Connection inactive: '+e.message));
})();
