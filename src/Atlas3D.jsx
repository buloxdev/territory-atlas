import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import './atlas3d.css';
import { useTerritory } from './LaunchApp.jsx';
import { mergeDiscoveredLocations } from './discovery.js';
import DiscoveryPanel from './DiscoveryPanel.jsx';
import useDiscoveryMap from './useDiscoveryMap.js';
import AreaControls from './AreaControls.jsx';

maplibregl.setWorkerUrl(mapWorkerUrl);

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const valid = p => Number.isFinite(Number(p.lng)) && Number.isFinite(Number(p.lat)) && Math.abs(Number(p.lat)) <= 85;
const fc = list => ({type:'FeatureCollection',features:list.filter(valid).map((p,i)=>({type:'Feature',geometry:{type:'Point',coordinates:[Number(p.lng),Number(p.lat)]},properties:{id:p.id,company:p.company,status:p.status,number:String(i+1)}}))});

export default function Atlas3D() {
  const { locations, setLocations } = useTerritory();
  const initialLocations = useRef(locations).current;
  const host=useRef(null), mapRef=useRef(null), selectRef=useRef(null), popup=useRef(null), locationsRef=useRef(initialLocations);
  const [query,setQuery]=useState(''), [filter,setFilter]=useState('All');
  const [selected,setSelected]=useState(null), [ready,setReady]=useState(false), [error,setError]=useState('');
  const [discoveryOpen,setDiscoveryOpen]=useState(false), [area,setArea]=useState(null), [drawing,setDrawing]=useState(false);
  const [discoveryResults,setDiscoveryResults]=useState([]), [activeResult,setActiveResult]=useState(null);
  const [shapeError,setShapeError]=useState('');
  const drawingRef=useRef(false), areaBeforeDrawing=useRef(null); drawingRef.current=drawing;
  const [pitch,setPitch]=useState(45), [zoom,setZoom]=useState(4), [help,setHelp]=useState(false);
  const shown=useMemo(()=>locations.filter(p=>(filter==='All'||p.status===filter)&&`${p.company} ${p.city} ${p.state}`.toLowerCase().includes(query.toLowerCase())),[locations,filter,query]);
  const duration=ms=>reduced()?0:ms;
  const startDrawing=(mode='circle')=>{
    const map=mapRef.current; if(!map)return;
    popup.current?.remove();setSelected(null);setActiveResult(null);setHelp(false);
    areaBeforeDrawing.current=area;map.stop();map.jumpTo({pitch:0,bearing:0});setShapeError('');setDrawing(mode);
  };
  const closeDiscovery=()=>{setDrawing(false);setDiscoveryOpen(false);setArea(null);setDiscoveryResults([]);setActiveResult(null);setShapeError('');};
  const focusResult=row=>{
    if(drawingRef.current)return;
    setSelected(null);popup.current?.remove();setActiveResult(row.id);
    mapRef.current?.flyTo({center:[row.lng,row.lat],zoom:Math.max(mapRef.current.getZoom(),13),pitch:0,duration:duration(600)});
  };
  const addDiscovered=rows=>{
    const result=mergeDiscoveredLocations(locations,rows);
    setLocations(result.locations);return result;
  };
  const discoveryAdapter=useDiscoveryMap(mapRef,ready,{area,drawing,results:discoveryResults,onAreaChange:setArea,onDrawingChange:setDrawing,onPick:id=>{
    const row=discoveryResults.find(item=>item.id===id);if(row)focusResult(row);
  }});

  const fit=(list=shown)=>{
    const m=mapRef.current, points=list.filter(valid); if(!m)return;
    popup.current?.remove(); setSelected(null);
    if(points.length===0){m.flyTo({center:[-98,39],zoom:3.6,pitch:35,bearing:0,duration:duration(900)});return;}
    const b=new maplibregl.LngLatBounds(); points.forEach(p=>b.extend([+p.lng,+p.lat]));
    m.fitBounds(b,{padding:90,maxZoom:11,pitch:40,bearing:0,duration:duration(1000)});
  };
  const focus=p=>{
    if(drawingRef.current)return;
    if(!valid(p))return;
    setSelected(p); const m=mapRef.current; if(!m)return;
    popup.current?.remove();
    const label=document.createElement('div'); label.className='atlas-map-label';
    const strong=document.createElement('strong');strong.textContent=p.company; label.appendChild(strong);
    const small=document.createElement('span');small.textContent=`${p.city}, ${p.state}`;label.appendChild(small);
    popup.current=new maplibregl.Popup({closeButton:false,closeOnClick:false,offset:17,maxWidth:'260px'}).setLngLat([+p.lng,+p.lat]).setDOMContent(label).addTo(m);
    m.flyTo({center:[+p.lng,+p.lat],zoom:16.2,pitch:60,bearing:-20,duration:duration(1800)});
  };
  selectRef.current=focus;
  locationsRef.current=locations;

  useEffect(()=>{
    let map;
    try {
      map=new maplibregl.Map({container:host.current,style:'https://tiles.openfreemap.org/styles/bright',center:[-109,39],zoom:4,pitch:45,bearing:0,maxPitch:75,maxZoom:19,minZoom:2,canvasContextAttributes:{antialias:true},attributionControl:true});
    }catch{setError('3D maps need WebGL. Enable hardware acceleration in your browser, or open the 2D map.');return;}
    mapRef.current=map;
    let loaded=false;
    const loadingTimeout=window.setTimeout(()=>{if(!loaded)setError('The map could not finish loading. Check your connection and reload, or use the 2D map.');},20000);
    map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'top-right');
    map.addControl(new maplibregl.ScaleControl({unit:'imperial'}),'bottom-left');
    map.on('move',()=>{setPitch(Math.round(map.getPitch()));setZoom(map.getZoom());});
    map.on('error',()=>setError('Some map tiles could not load. Check your internet connection and reload.'));
    map.on('idle',()=>{if(loaded)setError('');});
    map.on('load',()=>{
      const style=map.getStyle(), source=Object.keys(style.sources).find(k=>style.sources[k].type==='vector');
      const before=style.layers.find(l=>l.type==='symbol'&&l.layout?.['text-field'])?.id;
      if(source)map.addLayer({id:'atlas-buildings',type:'fill-extrusion',source,'source-layer':'building',minzoom:14,filter:['!=',['get','hide_3d'],true],paint:{'fill-extrusion-color':'#96b8b3','fill-extrusion-height':['coalesce',['get','render_height'],6],'fill-extrusion-base':['coalesce',['get','render_min_height'],0],'fill-extrusion-opacity':.9}},before);
      map.addSource('prospects',{type:'geojson',data:fc(initialLocations),cluster:true,clusterMaxZoom:12,clusterRadius:45});
      map.addLayer({id:'prospect-clusters',type:'circle',source:'prospects',filter:['has','point_count'],paint:{'circle-radius':21,'circle-color':'#153f3c','circle-stroke-width':3,'circle-stroke-color':'#55e4c8'}});
      map.addLayer({id:'cluster-count',type:'symbol',source:'prospects',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-font':['Noto Sans Regular'],'text-size':14},paint:{'text-color':'#ffffff'}});
      map.addLayer({id:'prospect-points',type:'circle',source:'prospects',filter:['!', ['has','point_count']],paint:{'circle-radius':10,'circle-color':['case',['==',['get','status'],'Customer'],'#ffb000','#117f6b'],'circle-stroke-width':3,'circle-stroke-color':'#ffffff'}});
      map.on('click','prospect-clusters',async e=>{if(drawingRef.current)return;const f=e.features[0];const z=await map.getSource('prospects').getClusterExpansionZoom(f.properties.cluster_id);map.easeTo({center:f.geometry.coordinates,zoom:z+.5,duration:duration(700)});});
      map.on('click','prospect-points',e=>{const id=e.features[0].properties.id; const p=locationsRef.current.find(p=>p.id===id);if(p)selectRef.current(p);});
      for(const id of ['prospect-clusters','prospect-points']){map.on('mouseenter',id,()=>map.getCanvas().style.cursor=drawingRef.current?'crosshair':'pointer');map.on('mouseleave',id,()=>map.getCanvas().style.cursor='');}
      loaded=true; window.clearTimeout(loadingTimeout); setError(''); setReady(true); fit(initialLocations);
    });
    const observer=new ResizeObserver(()=>map.resize()); observer.observe(host.current);
    return()=>{window.clearTimeout(loadingTimeout);observer.disconnect();popup.current?.remove();map.remove();mapRef.current=null;};
  },[]);
  useEffect(()=>{if(ready)mapRef.current?.getSource('prospects')?.setData(fc(shown)); if(selected&&!shown.some(p=>p.id===selected.id)){setSelected(null);popup.current?.remove();}},[shown,ready]);
  const tilt=value=>mapRef.current?.easeTo({pitch:value,duration:duration(400)});
  return <main className="atlas-app">
    <header className="atlas-header"><div className="atlas-brand"><span className="atlas-logo">◈</span><div><strong>TERRITORY ATLAS</strong><small>CUSTOMERS + PROSPECTS / UNITED STATES</small></div></div><div className="atlas-mode"><i/> Interactive 3D map</div><a href="?view=2d">Import / manage locations <span>↗</span></a></header>
    <div className={`atlas-workspace ${discoveryOpen?'discovering':''}`}>
      <aside className="atlas-sidebar">{discoveryOpen?<DiscoveryPanel area={area} drawing={drawing} ready={ready} locations={locations} onDraw={startDrawing} onCancelDraw={()=>{setArea(areaBeforeDrawing.current);setDrawing(false);}} onAreaChange={setArea} onResults={setDiscoveryResults} onFocus={focusResult} onAdd={addDiscovered} onClose={closeDiscovery} activeResult={activeResult} shapeError={shapeError}/>:<><div className="atlas-sidebar-top"><div className="atlas-kicker">YOUR NETWORK <span>{String(locations.length).padStart(2,'0')}</span></div><h1>Explore your territory.</h1><p>A free, open-source territory map for freight and industrial sales reps. Import your accounts, explore nearby facilities, and plan customer visits.</p><p className="account-storage-note">Import once. Your accounts stay saved in this browser when you refresh or return to the same site. Use Backup to keep a copy or move to another browser or device; clearing site storage removes saved accounts.</p><button className="atlas-discover-button" disabled={!ready} onClick={()=>{setDiscoveryOpen(true);popup.current?.remove();setSelected(null);}}>◯ &nbsp; Find nearby businesses</button><label className="atlas-search"><span>⌕</span><input aria-label="Search accounts" placeholder="Company, city or state" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label="Clear search" onClick={()=>setQuery('')}>×</button>}</label><div className="atlas-filters">{['All','Prospect','Customer'].map(f=><button key={f} aria-pressed={filter===f} onClick={()=>setFilter(f)}>{f==='All'?'All locations':f+'s'}</button>)}</div></div>
      <div className="atlas-location-list">{shown.map((p,i)=><button key={p.id} className={`atlas-location ${selected?.id===p.id?'chosen':''}`} onClick={()=>focus(p)} disabled={!ready||!valid(p)}><span className="atlas-index">{String(i+1).padStart(2,'0')}</span><span><strong>{p.company}</strong><small>{p.city}, {p.state}</small><em>{p.status} · {p.locationType}</em></span><span className="atlas-arrow">↗</span></button>)}{!shown.length&&<div className="atlas-empty">No locations match.<button onClick={()=>{setQuery('');setFilter('All');}}>Clear filters</button></div>}</div>
      <div className="atlas-sidebar-bottom"><button disabled={!ready} onClick={()=>fit()}>⌖ &nbsp; Fit {shown.length} locations</button><small><i/> Prospects <i className="customer"/> Customers</small><p>{locations.length > 0 && locations.every(p=>p.source?.startsWith('Fictional demo')) ? 'Fictional demo accounts at city centers.' : 'Review coordinates before planning a visit.'}</p></div></>}</aside>
      <section className="atlas-map-area" aria-label="Interactive territory map"><div ref={host} className="atlas-map"/><AreaControls adapter={discoveryAdapter} area={area} drawing={drawing} enabled={discoveryOpen} onAreaChange={setArea} onDrawingChange={setDrawing} onError={setShapeError}/>
      <div className="atlas-map-top"><span>{drawing?(drawing==='freehand'?'Draw your search outline':'Draw your search circle'):area?'Business search area':selected?`${selected.city}, ${selected.state}`:'Network overview'}</span><button disabled={!ready||drawing} onClick={()=>{setQuery('');setFilter('All');fit(locations);}}>Reset view</button></div>
      {!ready&&!error&&<div className="atlas-loading" role="status">Loading your map…</div>}
      {error&&<div className="atlas-error" role="alert">{error} <a href="?view=2d">Open 2D map</a></div>}
      <div className={`atlas-view-controls ${drawing?'drawing-disabled':''}`} inert={drawing?true:undefined}><button aria-pressed={pitch>5} onClick={()=>tilt(pitch>5?0:60)}>{pitch>5?'3D':'2D'}</button><label>Tilt <input aria-label="Map tilt" type="range" min="0" max="75" value={pitch} onChange={e=>tilt(+e.target.value)}/><span>{pitch}°</span></label><button aria-label="Rotate map left" onClick={()=>mapRef.current?.easeTo({bearing:mapRef.current.getBearing()-30,duration:duration(400)})}>↶</button><button aria-label="Rotate map right" onClick={()=>mapRef.current?.easeTo({bearing:mapRef.current.getBearing()+30,duration:duration(400)})}>↷</button></div>
      {!discoveryOpen&&(selected?<aside className="atlas-details" aria-label="Selected account"><button className="atlas-close" aria-label="Close location details" onClick={()=>{setSelected(null);popup.current?.remove();}}>×</button><div className="atlas-kicker">{selected.status} / {selected.locationType}</div><h2>{selected.company}</h2><p>{selected.address||`${selected.city}, ${selected.state}`}</p><div className="atlas-detail-actions"><button onClick={()=>focus(selected)}>Focus location</button><button onClick={()=>mapRef.current?.flyTo({center:[+selected.lng,+selected.lat],zoom:12,pitch:45,duration:duration(850)})}>Neighborhood</button></div><small>3D buildings appear where map data is available.</small></aside>:<div className="atlas-hint"><strong>Start with an account.</strong><span>Choose a company on the left, or click a map marker.</span></div>)}
      {drawing&&<div className="discovery-map-instruction" role="status">{drawing==='freehand'?'Trace the area you want to search':'Drag from the center to the edge'}<br/><small>{drawing==='freehand'?'Release to close the outline':'Or tap the center, then the edge'}</small></div>}
      {discoveryOpen&&area&&!drawing&&<div className="discovery-map-legend"><i/> New matches <i className="existing"/> Already in territory</div>}
      <div className="atlas-help"><button onClick={()=>setHelp(!help)} aria-expanded={help}>? &nbsp; Map controls</button>{help&&<div><p><b>Move</b> Drag the map</p><p><b>Zoom</b> Scroll or pinch</p><p><b>Rotate & tilt</b> Right-drag, or Ctrl + drag</p><p><b>Keyboard</b> Arrow keys to pan; + / − to zoom</p><p>Use the tilt slider and rotation buttons on a trackpad.</p></div>}</div>
      <div className="atlas-zoom-note">{zoom>=14?'BUILDING VIEW':'ZOOM INTO A LOCATION FOR 3D BUILDINGS'}</div>
      </section>
    </div>
  </main>;
}
