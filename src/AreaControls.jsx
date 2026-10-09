import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { bindAreaGestures } from './area-gestures.js';
import { areaCenter, areaHandles, isFreehand, resizeArea, translateArea } from './search-area.js';
import './area-controls.css';

const directions = { n: 'north', e: 'east', s: 'south', w: 'west', ne: 'northeast', nw: 'northwest', se: 'southeast', sw: 'southwest' };
export default function AreaControls({ adapter, area, drawing, enabled, onAreaChange, onDrawingChange, onError }) {
  const current = useRef();
  const [preview, setPreview] = useState(null), [, setRevision] = useState(0);
  current.current = { area, drawing, enabled, onAreaChange, onDrawingChange, onError, onPreview: setPreview };
  useEffect(() => {
    if (!adapter) return;
    const release = bindAreaGestures(adapter, () => current.current);
    const redraw = () => setRevision(value => value + 1);
    const unsubscribe = adapter.subscribe(redraw);
    const observer = new ResizeObserver(redraw); observer.observe(adapter.container);
    return () => { release(); unsubscribe(); observer.disconnect(); };
  }, [adapter]);
  useEffect(() => { if (!drawing) setPreview(null); }, [drawing]);
  useEffect(() => {
    if (!adapter) return;
    adapter.container.classList.toggle('area-drawing', Boolean(drawing));
    return () => adapter.container.classList.remove('area-drawing');
  }, [adapter, drawing]);
  if (!adapter || !enabled) return null;
  const center = area && adapter.project(areaCenter(area)), handles = area && areaHandles(area);
  const arrow = (event, action, handle) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) || !area) return;
    event.preventDefault(); event.stopPropagation();
    const step = event.shiftKey ? 40 : 10;
    const point = adapter.project(action === 'move' ? areaCenter(area) : handles.find(item => item.id === handle));
    const target = adapter.unproject({ x: point.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), y: point.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0) });
    try { onAreaChange(action === 'move' ? translateArea(area, target) : resizeArea(area, handle, target)); onError(''); }
    catch (error) { onError(error.message); }
  };
  return createPortal(<div className="search-area-controls">
    {preview && <svg className="search-area-stroke" aria-hidden="true"><polyline points={preview.map(point => { const p = adapter.project(point); return `${p.x},${p.y}`; }).join(' ')} /></svg>}
    {area && !drawing && <>
      {isFreehand(area) && <svg className="search-area-stroke search-area-bounds" aria-hidden="true"><polygon points={handles.map(point => { const p = adapter.project(point); return `${p.x},${p.y}`; }).join(' ')} /></svg>}
      <button type="button" className="search-area-move" data-area-move="true" aria-label="Move search area" title="Drag to move. Arrow keys also move the area." style={{ left: center.x, top: center.y }} onKeyDown={event => arrow(event, 'move')}>✥</button>
      {handles.map(handle => { const p = adapter.project(handle); return <button type="button" key={handle.id} className={`search-area-handle handle-${handle.id}`} data-area-handle={handle.id} aria-label={`Resize area ${directions[handle.id]}`} title="Drag to resize. Arrow keys also resize the area." style={{ left: p.x, top: p.y }} onKeyDown={event => arrow(event, 'resize', handle.id)} />; })}
    </>}
  </div>, adapter.container);
}
