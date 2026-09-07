import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowUpRight, Check, ChevronDown, Heart, ImagePlus, MapPin, Sparkles, Upload, Users, X} from 'lucide-react';
import * as THREE from 'three';
import './styles.css';
import {REPAIR_CITIES, parseRepairCost, repairTitle, validatePhoto} from './repair-form.mjs';

function Glyph({tone}){return <div className={'glyph '+tone}><span></span><i></i><b></b></div>}
function Progress({value,cost}){const p=cost>0?Math.min(100,Math.round(value/cost*100)):0; return <div className="progress"><span style={{width:p+'%'}}></span><em>₹{value.toLocaleString('en-IN')} pledged</em><small>{p}%</small></div>}
function RepairReveal(){const mount=useRef(null);useEffect(()=>{const el=mount.current;if(!el)return;const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.1,100);camera.position.set(0,.2,4.1);const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(el.clientWidth,el.clientHeight);el.appendChild(renderer.domElement);scene.add(new THREE.AmbientLight(0xffffff,1.2));const key=new THREE.DirectionalLight(0xffe1ad,2.1);key.position.set(2,3,4);scene.add(key);const healthy=new THREE.Color('#d98a2f'),broken=new THREE.Color('#76816f');const orb=new THREE.Mesh(new THREE.IcosahedronGeometry(1.18,4),new THREE.MeshStandardMaterial({color:broken,roughness:.72}));scene.add(orb);const cracks=[];[[[-.65,.28,.91],[-.25,.1,1.04],[.06,.3,1.08]],[[.55,.64,.78],[.34,.26,1.08],[.65,-.08,.92]],[[.1,-.75,.92],[-.23,-.42,1.08],[-.05,-.14,1.16]],[[-.72,-.1,.88],[-.43,-.28,1.04],[-.55,-.56,.86]],[[-.08,.8,.83],[.08,.55,1.04],[-.09,.37,1.11]]].forEach((points,i)=>{const mat=new THREE.LineBasicMaterial({color:'#253129',transparent:true,opacity:.85});const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),mat);line.userData.delay=i*.1;scene.add(line);cracks.push(line)});let frame,start;const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;const tick=t=>{if(!start)start=t;const n=reduce?1:Math.min(1,(t-start)/1800);orb.material.color.lerpColors(broken,healthy,n);orb.rotation.y=n*.28;cracks.forEach(line=>{const p=Math.max(0,Math.min(1,(n-line.userData.delay)/.48));line.scale.setScalar(1-p*.94);line.material.opacity=.85*(1-p)});renderer.render(scene,camera);if(n<1)frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(frame);renderer.dispose();orb.geometry.dispose();orb.material.dispose();cracks.forEach(x=>{x.geometry.dispose();x.material.dispose()});renderer.domElement.remove()};},[]);return <div className="repair-reveal" aria-label="A damaged object healing itself"><div ref={mount}></div><p><Sparkles size={14}/> A small repair, made whole</p></div>}
function App(){
 const [items,setItems]=useState([]),[city,setCity]=useState('Lucknow'),[severity,setSeverity]=useState('All'),[sort,setSort]=useState('Most needed'),[assessing,setAssessing]=useState(false),[assessed,setAssessed]=useState(false),[description,setDescription]=useState(''),[notice,setNotice]=useState(''),[assessment,setAssessment]=useState(null),[assessmentError,setAssessmentError]=useState(''),[photo,setPhoto]=useState(null),[showAll,setShowAll]=useState(false);
 const [loading,setLoading]=useState(true),[feedError,setFeedError]=useState(''),[reload,setReload]=useState(0),[repairCity,setRepairCity]=useState('Lucknow'),[people,setPeople]=useState(''),[submitting,setSubmitting]=useState(false),[pledging,setPledging]=useState(new Set()),[photoLoading,setPhotoLoading]=useState(false),[photoError,setPhotoError]=useState(''),[submitError,setSubmitError]=useState('');
 const submitLock=useRef(false),assessLock=useRef(false),pledgeLocks=useRef(new Set()),photoVersion=useRef(0),photoInput=useRef(null),noticeTimer=useRef(null);
 const notify=(message)=>{clearTimeout(noticeTimer.current);setNotice(message);noticeTimer.current=setTimeout(()=>setNotice(''),6000)};
 const clearAssessment=()=>{setAssessment(null);setAssessed(false);setAssessmentError('');setSubmitError('')};
 useEffect(()=>()=>clearTimeout(noticeTimer.current),[]);
 useEffect(()=>{
  const controller=new AbortController();
  const sortKey={'Most needed':'needed','Lowest cost':'cost','Most people helped':'people'}[sort];
  setLoading(true);setFeedError('');setItems([]);
  fetch(`/api/repairs?city=${encodeURIComponent(city)}&severity=${encodeURIComponent(severity)}&sort=${sortKey}`,{signal:controller.signal})
   .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'Repairs could not be loaded.');if(!Array.isArray(data))throw new Error('The repair list could not be read.');return data})
   .then(data=>{if(!controller.signal.aborted)setItems(data)})
   .catch(error=>{if(!controller.signal.aborted)setFeedError(error.message||'Repairs could not be loaded.')})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort()
 },[city,severity,sort,reload]);
 const shown=useMemo(()=>items.filter(x=>(city==='All cities'||x.place.includes(city))&&(severity==='All'||x.severity===severity)).sort((a,b)=>sort==='Lowest cost'?a.cost-b.cost:sort==='Most people helped'?b.people-a.people:b.cost-a.cost),[items,city,severity,sort]);
 const visible=showAll?shown:shown.slice(0,3);
 const assessmentNeedsReview=assessment&&(assessment.requiresReview||assessment.eligibleForListing===false||assessment.isRepairPhoto===false||assessment.source!=='gemini'||assessment.plausibility!=='Likely genuine');
 const pledge=async(repair)=>{
  const id=repair.id;if(pledgeLocks.current.has(id)||repair.funded>=repair.cost)return;
  pledgeLocks.current.add(id);setPledging(new Set(pledgeLocks.current));
  const amount=Math.min(1000,repair.cost-repair.funded);
  try{
   const response=await fetch(`/api/repairs/${encodeURIComponent(id)}/pledges`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||'We could not save that pledge. Please try again.');
   if(!data.repair?.id)throw new Error('The pledge may have been saved, but confirmation was missing. Reload the repair list before trying again.');
   setItems(current=>current.map(item=>String(item.id)===String(data.repair.id)?data.repair:item));
   notify('Pledge recorded. No money has been charged.');
  }catch(error){notify(error.message||'We could not save that pledge. Please try again.')}
  finally{pledgeLocks.current.delete(id);setPledging(new Set(pledgeLocks.current))}
 };
 const submitRepair=async()=>{
  if(submitLock.current||!assessment)return;
  setSubmitError('');
  let payload;
  try{
   if(assessmentNeedsReview)throw new Error('This photo needs review. Add a clear photo of the shared item that needs repair and assess it again.');
   const title=repairTitle(description);
   if(!REPAIR_CITIES.includes(repairCity))throw new Error('Choose the city where this repair is located.');
   if(!Number.isInteger(Number(people))||Number(people)<1||Number(people)>100000)throw new Error('Enter a realistic number of people helped, from 1 to 100,000.');
   payload={title,location:repairCity,severity:assessment.severity,cost:parseRepairCost(assessment.cost),people:Number(people),reason:assessment.reasoning,imageUrl:photo?`data:${photo.mimeType};base64,${photo.data}`:null};
  }catch(error){setSubmitError(error.message);return}
  submitLock.current=true;setSubmitting(true);
  try{
   const response=await fetch('/api/repairs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||'Could not submit this repair. Please try again.');
   if(!data.repair?.id)throw new Error('The repair may have been saved, but confirmation was missing. Reload the repair list before trying again.');
   setItems(current=>[data.repair,...current.filter(item=>String(item.id)!==String(data.repair.id))]);
   setCity(repairCity);setSeverity('All');setShowAll(true);setReload(value=>value+1);
   clearAssessment();setDescription('');setPeople('');setPhoto(null);if(photoInput.current)photoInput.current.value='';
   notify(`Repair submitted to the ${repairCity} line.`);
  }catch(error){setSubmitError(error.message||'Could not submit this repair. Please try again.')}
  finally{submitLock.current=false;setSubmitting(false)}
 };
 const assess=async()=>{
  if(assessLock.current||submitting||photoLoading)return;
  clearAssessment();
  try{repairTitle(description);if(!photo)throw new Error('Add a JPEG, PNG, or WebP photo of the broken item before assessing it.')}
  catch(error){setAssessmentError(error.message);return}
  assessLock.current=true;setAssessing(true);
  try{
   const response=await fetch('/api/assess',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({description,imageBase64:photo.data,mimeType:photo.mimeType})});
   const data=await response.json().catch(()=>({error:'The live assessment service is not ready yet.'}));
   if(!response.ok)throw new Error(data.error||'Assessment is temporarily unavailable.');
   setAssessment(data);setAssessed(true);
  }catch(error){setAssessmentError(error.message||'Assessment is temporarily unavailable.')}
  finally{assessLock.current=false;setAssessing(false)}
 };
 const selectPhoto=(event)=>{
  const file=event.target.files?.[0];if(!file)return;
  const version=++photoVersion.current;
  clearAssessment();setPhoto(null);setPhotoError('');setPhotoLoading(false);
  try{validatePhoto(file)}catch(error){setPhotoError(error.message);event.target.value='';return}
  setPhotoLoading(true);
  const reader=new FileReader();
  reader.onload=()=>{if(version!==photoVersion.current)return;setPhoto({data:String(reader.result).split(',')[1],mimeType:file.type,name:file.name});setPhotoLoading(false)};
  reader.onerror=()=>{if(version!==photoVersion.current)return;setPhotoError('This photo could not be read. Please choose it again.');setPhotoLoading(false)};
  reader.readAsDataURL(file)
 };
 return <main><header><a className="brand" href="#top"><span className="mark">↗</span><span>The Repair Line</span></a><nav><a href="#repairs">Repairs</a><a href="#closure">Proof of repair</a><a href="#how">How it works</a></nav><button className="submit" onClick={()=>document.querySelector('.assessor').scrollIntoView({behavior:'smooth'})}>Submit a repair <ArrowUpRight size={16}/></button></header>
 {notice&&<div className="toast" role="status">{notice}</div>}
 <section id="top" className="intro"><div><p className="eyeline">Small repairs. Shared relief.</p><h1>The little fixes that<br/>keep <em>{city==='All cities'?'our cities':city}</em> moving.</h1><p className="lede">A photo can turn a broken shared thing into a small, local repair—so neighbours can get back to their day.</p><div className="hero-actions"><button onClick={()=>document.querySelector('.assessor').scrollIntoView({behavior:'smooth'})}>Turn a photo into a fix <ArrowUpRight size={17}/></button><a href="#repairs">See repairs near me <MapPin size={16}/></a></div></div><div className="intro-note"><span>Up to ₹10,000</span><p>Small, local costs. Share the problem, understand the estimate, and record a pledge.</p></div></section>
 <section id="how" className="how"><p className="eyeline">For our neighbourhood</p><h2>Here’s how a repair gets started</h2><div className="steps"><div><b>01</b><h3>Share what is broken</h3><p>Send one photo of the small shared thing that needs attention.</p></div><div><b>02</b><h3>Understand the estimate</h3><p>Get a directional AI estimate for a repair within ₹10,000.</p></div><div><b>03</b><h3>Record a pledge</h3><p>Show your interest in helping a listed repair. Pledges do not charge money.</p></div></div></section>
 <section id="repairs" className="layout"><div className="feed">
  <div className="feedhead"><div><p className="eyeline">Open repair line</p><h2>{city==='All cities'?'Repairs across ': 'Repairs near '}<em>{city==='All cities'?'our cities':city}</em></h2></div><p className="count">{loading?'Loading repairs…':feedError?'List unavailable':`${shown.length} repairs found`}</p></div>
  <div className="filters"><label>Location <select value={city} onChange={e=>{setCity(e.target.value);setShowAll(false)}}>{REPAIR_CITIES.map(name=><option key={name}>{name}</option>)}<option>All cities</option></select><ChevronDown size={14}/></label><label>Severity <select value={severity} onChange={e=>setSeverity(e.target.value)}><option>All</option><option>High</option><option>Medium</option><option>Low</option></select><ChevronDown size={14}/></label><label>Sort by <select value={sort} onChange={e=>setSort(e.target.value)}><option>Most needed</option><option>Lowest cost</option><option>Most people helped</option></select><ChevronDown size={14}/></label></div>
  <div className="listinglist" aria-busy={loading}>
   {loading&&<p className="feed-state" role="status">Loading the repair line…</p>}
   {!loading&&feedError&&<div className="feed-state" role="alert"><p>{feedError}</p><button className="show-more" onClick={()=>setReload(value=>value+1)}>Try again</button></div>}
   {!loading&&!feedError&&shown.length===0&&<div className="feed-state"><h3>No repairs found here yet.</h3><p>Try another location or severity, or share a repair that your neighbourhood needs.</p></div>}
   {!loading&&!feedError&&visible.map(x=><article className="listing" key={x.id}><div className="photo">{x.image?<img src={x.image} alt={x.title}/>:<Glyph tone={x.tone}/>}<span className={'severity '+x.severity.toLowerCase()}>{x.severity}</span></div><div className="listingcopy"><div className="listingtitle"><div><h3>{x.title}</h3><p><MapPin size={14}/>{x.place} <span>·</span><Users size={14}/>{x.people} people</p></div><strong>₹{x.cost.toLocaleString('en-IN')}</strong></div><p className="reason">{x.reason}</p><Progress value={x.funded} cost={x.cost}/><button className="pledge" onClick={()=>pledge(x)} disabled={pledging.has(x.id)||x.funded>=x.cost}>{pledging.has(x.id)?'Saving pledge…':x.funded>=x.cost?'Fully pledged':`Pledge ₹${Math.min(1000,x.cost-x.funded).toLocaleString('en-IN')}`} <Heart size={15}/></button></div></article>)}
  </div>{!loading&&!feedError&&shown.length>3&&<button className="show-more" onClick={()=>setShowAll(v=>!v)}>{showAll?'Show fewer repairs':`Show all ${shown.length} repairs`} <ArrowUpRight size={15}/></button>}
 </div>
 <aside className="assessor"><div className="paneltop"><p className="eyeline">A closer look at what is broken</p><h2>Assess a repair</h2><p>Share one photo and a short description. The assessment explains what it sees before it asks anyone to help.</p></div>
  <label className="drop"><input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} disabled={assessing||submitting}/><ImagePlus size={22}/><b>{photoLoading?'Reading photo…':photo?photo.name:'Add a photo'}</b><span>JPEG, PNG, or WebP · up to 2 MB</span></label>
  {photoError&&<p className="assessment-error" role="alert">{photoError}</p>}
  <label className="field">What needs fixing?<textarea value={description} maxLength={2000} disabled={assessing||submitting} onChange={e=>{setDescription(e.target.value);clearAssessment()}} placeholder="For example: The shared hand pump has a loose handle and a crack around its concrete base."/></label>
  <div className="repair-details"><label className="field">Repair city<select value={repairCity} disabled={submitting} onChange={e=>{setRepairCity(e.target.value);setSubmitError('')}}>{REPAIR_CITIES.map(name=><option key={name}>{name}</option>)}</select></label><label className="field">People helped<input type="number" min="1" max="100000" step="1" value={people} disabled={submitting} onChange={e=>{setPeople(e.target.value);setSubmitError('')}} placeholder="Your estimate"/></label></div>
  <button className="assess" onClick={assess} disabled={assessing||submitting||photoLoading}>{assessing?<><Sparkles size={17} className="spin"/>Looking closely…</>:<><Sparkles size={17}/>Assess this repair</>}</button>
  {assessmentError&&<p className="assessment-error" role="alert">{assessmentError}</p>}
  {assessed&&assessment&&<div className="result"><div className="resulthead"><span><Sparkles size={15}/> {assessmentNeedsReview?'Photo needs review':'Gemini assessment complete'}</span><button aria-label="Dismiss assessment" disabled={submitting} onClick={clearAssessment}><X size={15}/></button></div><div className="metrics"><div><small>Severity</small><b>{assessment.severity||'Needs review'}</b></div><div><small>Directional cost</small><b>{assessment.cost||'Not estimated'}</b></div></div><div className="plausibility"><small>Plausibility</small><strong>{assessment.plausibility}</strong><p>{assessment.reasoning}</p></div><button className="publish" onClick={submitRepair} disabled={submitting||assessmentNeedsReview}>{submitting?'Saving repair…':'Add this repair to the line'} <ArrowUpRight size={15}/></button>{assessmentNeedsReview&&<p className="assessment-error">Add a clearer photo of the shared item and assess it again before submitting.</p>}</div>}
  {submitError&&<p className="assessment-error" role="alert">{submitError}</p>}
  <p className="disclaimer">AI estimates are directional guidance, not guaranteed quotes. The upper end of a valid estimate becomes the pledge target. Pledges record interest; they do not collect payment.</p>
 </aside></section>
 <section id="closure" className="closure"><div><p className="eyeline">Our vision for proof of repair</p><h2>A small fix deserves<br/>a visible <em>finish.</em></h2><p>We want every repair to end with clear before-and-after evidence. Proof uploads and community verification are planned features.</p></div><div className="closure-right"><figure className="repair-photo"><img src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=85" alt="Illustrative stock photo of construction workers"/><figcaption><Sparkles size={14}/> An illustrative repair concept</figcaption></figure><div className="beforeafter"><div className="before"><img src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=700&q=85" alt="Stock photo illustrating work in progress"/><span>Before · illustration</span></div><div className="after"><img src="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=700&q=85" alt="Stock photo illustrating repair work"/><span>After · illustration</span></div><p>Stock images show the concept, not a completed repair on this platform.</p></div></div></section>
 <footer><span className="mark">↗</span><p>Photo in, fixed out.</p><small>Built for small, shared, unglamorous repairs.</small></footer></main>
}
createRoot(document.getElementById('root')).render(<App/>);
