/* Apex Google Earth export and optional Google Maps satellite panel.
   No API keys or contacts transmitted automatically. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
if(!$('earthExportCSV')||!$('earthExportKML'))return;
const status=(msg)=>{$('earthMessage').textContent=msg};
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const validCoord=r=>!!r.locationVerified&&Number.isFinite(Number(r.latitude))&&Number.isFinite(Number(r.longitude))&&Number(r.latitude)>=38&&Number(r.latitude)<=42&&Number(r.longitude)>=-86&&Number(r.longitude)<=-82;
const safeName=s=>String(s||'').replace(/[^a-z0-9_-]/gi,'-');
const entries=()=>allRows.map((row,i)=>({i,row,record:recordFor(i)}));
function download(text,name,type){
 const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function earthUrl(r){
 if(validCoord(r))return 'https://earth.google.com/web/search/'+encodeURIComponent(Number(r.latitude).toFixed(7)+','+Number(r.longitude).toFixed(7));
 return 'https://earth.google.com/web/search/'+encodeURIComponent(r.address||r.company||'Ohio');
}
function openEarth(r){
 if(!r)return;
 window.open(earthUrl(r),'_blank','noopener,noreferrer');
}
$('earthOpen').addEventListener('click',()=>window.open('https://earth.google.com/web/','_blank','noopener,noreferrer'));
$('earthFacility').addEventListener('click',()=>{
 if(selected===null){status('Select a facility in the directory or on the map first.');return}
 openEarth(recordFor(selected));
});
$('earthExportCSV').addEventListener('click',()=>{
 // Addresses are the geocoding field. Avoid exporting personal contact information by default.
 const head=['Name','Address','CityState','Territory','Latitude','Longitude','Verified Location','Facility Type','Contact Status'];
 const quote=x=>'"'+String(x??'').replaceAll('"','""')+'"';
 const lines=[head.map(quote).join(',')];
 for(const {row,record:r} of entries()){
  const coords=validCoord(r);
  const address=(r.address||'')+(r.address&& !/\bOH\b|Ohio/i.test(r.address)?', Ohio':'');
  lines.push([r.company,address,'Ohio, USA',row.dataset.territory,coords?r.latitude:'',coords?r.longitude:'',coords?'Yes':'No',r.type,recordStatus(Number(row.dataset.index))].map(quote).join(','));
 }
 download('\uFEFF'+lines.join('\r\n'),'apex-facilities-google-earth.csv','text/csv;charset=utf-8');
 status('Downloaded all '+allRows.length+' facilities as CSV for Google Earth import. Address-based locations still need geocoding and verification in Google Earth.');
});
$('earthExportKML').addEventListener('click',()=>{
 const rows=entries().filter(({record:r})=>validCoord(r));
 if(!rows.length){status('No verified coordinates yet. Use the CSV export for address-based import, or verify facility coordinates first.');return}
 const folders=new Map();
 for(const e of rows){let l=folders.get(e.row.dataset.territory);if(!l){l=[];folders.set(e.row.dataset.territory,l)}l.push(e)}
 let kml='<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Apex Floor Coatings — Verified Facilities</name><description>Verified facility points only. Sales contact details excluded.</description>';
 for(const [territory,list] of folders){
  kml+='<Folder><name>'+esc(territory)+'</name>';
  for(const {record:r} of list){
   kml+='<Placemark><name>'+esc(r.company)+'</name><description>'+esc((r.address||'')+' | '+(r.type||'Facility')+' | '+(r.salesStatus||'Not Contacted'))+'</description><Point><coordinates>'+Number(r.longitude)+','+Number(r.latitude)+',0</coordinates></Point></Placemark>';
  }
  kml+='</Folder>';
 }
 kml+='</Document></kml>';
 download(kml,'apex-verified-facilities-google-earth.kml','application/vnd.google-earth.kml+xml;charset=utf-8');
 status('Exported '+rows.length+' verified facility pins as a KML file. Import it into Google Earth.');
});
let map=null,markers=[],initialized=false,loading=false;
function verifiedSites(){return entries().filter(({record:r})=>validCoord(r))}
function showSatellite(){
 const root=$('googleSatelliteMap');root.hidden=false;
 if(map){google.maps.event.trigger(map,'resize');return}
 const center={lat:39.65,lng:-84.25};
 map=new google.maps.Map(root,{center,zoom:9,mapTypeId:'hybrid',mapTypeControl:true,streetViewControl:false,fullscreenControl:true});
 const sites=verifiedSites();
 for(const {i,record:r} of sites){
  const marker=new google.maps.Marker({position:{lat:Number(r.latitude),lng:Number(r.longitude)},map,title:r.company});
  marker.addListener('click',()=>{
   selectFacility(i);const info=$('satelliteSelected');
   info.textContent=r.company+' — '+r.address;
  });markers.push(marker);
 }
 const b=new google.maps.LatLngBounds();
 if(sites.length){sites.forEach(({record:r})=>b.extend({lat:Number(r.latitude),lng:Number(r.longitude)}));map.fitBounds(b);if(sites.length===1)map.setZoom(15)}
 status('Google satellite map loaded. '+sites.length+' verified facility pins shown. Unverified approximate map pins were intentionally excluded.');
 $('satelliteHide').hidden=false;
}
window.__apexSatelliteInit=()=>{initialized=true;loading=false;try{showSatellite()}catch(e){status('Satellite map could not open: '+e.message)}};
$('satelliteLoad').addEventListener('click',()=>{
 if(initialized){showSatellite();return}
 if(loading){status('Google satellite imagery is loading…');return}
 const key=$('satelliteKey').value.trim();
 if(!/^[a-zA-Z0-9_-]{20,200}$/.test(key)){status('Enter a valid browser-restricted Google Maps JavaScript API key to load satellite imagery.');return}
 loading=true;status('Loading the Google Maps satellite map using your key…');
 const sc=document.createElement('script');
 sc.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(key)+'&callback=__apexSatelliteInit&loading=async';
 sc.async=true;sc.onerror=()=>{loading=false;status('Google Maps could not load. Check the Maps JavaScript API, key restrictions and billing.')};
 document.head.appendChild(sc);
});
$('satelliteHide').addEventListener('click',()=>{
 $('googleSatelliteMap').hidden=true;
 $('satelliteHide').hidden=true;
 status('Satellite view hidden. The original Apex SVG territory map remains available above.');
});
})();
