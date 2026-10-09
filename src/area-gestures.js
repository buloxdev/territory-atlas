import { areaCenter, areaHandles, containsPoint, createFreehandArea, distanceMeters, isFreehand, MAX_SEARCH_RADIUS_METERS, resizeArea, translateArea } from './search-area.js';

// Map-library-specific work is confined to the adapter. Mouse, pen and touch
// share the same gesture rules in the Leaflet and MapLibre views.
export function bindAreaGestures(adapter, getOptions) {
  const host = adapter.container;
  let gesture = null, tappedCenter = null, originalDrawingArea = null, drawingMode = null, suppressClick = false;
  const pixel = event => { const rect = host.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; };
  const hit = (point, target) => {
    const options = getOptions(), area = options.area;
    if (!options.enabled || !area) return null;
    const handle = target.closest?.('[data-area-handle]');
    if (handle) return { action: 'resize', handle: handle.dataset.areaHandle };
    if (target.closest?.('[data-area-move]')) return { action: 'move' };
    if (adapter.isMarker?.(point, target)) return null;
    const coordinate = adapter.unproject(point);
    if (!isFreehand(area)) {
      const center = adapter.project(area), radius = Math.hypot(point.x - center.x, point.y - center.y);
      const edge = adapter.project(areaHandles(area)[1]);
      // Compare ground distances, allowing a screen-space tolerance at any edge.
      const atEdge = adapter.unproject({ x: point.x + 10, y: point.y });
      if (Math.abs(distanceMeters(area, coordinate) - area.radius) <= Math.max(10, distanceMeters(coordinate, atEdge))) return { action: 'resize', handle: 'e' };
      if (!Number.isFinite(radius) || !Number.isFinite(edge.x)) return null;
    }
    return containsPoint(area, coordinate) ? { action: 'move' } : null;
  };
  const ensureDrawingSnapshot = options => {
    if (options.drawing && drawingMode !== options.drawing) { drawingMode = options.drawing; originalDrawingArea = options.area; tappedCenter = null; }
    if (!options.drawing) { drawingMode = null; tappedCenter = null; }
  };
  const finish = () => {
    if (gesture) {
      const id = gesture.pointer;
      if (host.hasPointerCapture(id)) host.releasePointerCapture(id);
      adapter.restoreNavigation(gesture.navigation);
    }
    gesture = null; host.style.cursor = ''; getOptions().onPreview(null);
  };
  const cancel = () => {
    const options = getOptions();
    if (gesture || options.drawing) {
      options.onAreaChange(options.drawing ? originalDrawingArea : gesture.original);
      if (options.drawing) options.onDrawingChange(false);
      finish(); tappedCenter = null; drawingMode = null;
    }
  };
  const down = event => {
    const options = getOptions(); ensureDrawingSnapshot(options);
    if (!event.isPrimary || event.button !== 0 || gesture || !options.enabled) return;
    suppressClick = false;
    const point = pixel(event), handleTarget = event.target.closest?.('[data-area-handle],[data-area-move]');
    if (!handleTarget && event.target.closest?.('button,a,input,.leaflet-control-container,.maplibregl-control-container')) return;
    const mode = options.drawing === true ? 'circle' : options.drawing;
    const action = mode ? { action: mode } : hit(point, event.target);
    if (!action) return;
    event.preventDefault(); event.stopImmediatePropagation(); suppressClick = true;
    const start = adapter.unproject(point);
    gesture = { ...action, pointer: event.pointerId, original: options.area, start, startPixel: point, lastPixel: point, navigation: adapter.suspendNavigation(), points: [start] };
    host.setPointerCapture(event.pointerId); options.onError('');
    if (action.action === 'circle') {
      gesture.center = tappedCenter || start;
      options.onAreaChange({ ...gesture.center, radius: tappedCenter ? Math.max(100, Math.min(MAX_SEARCH_RADIUS_METERS, distanceMeters(tappedCenter, start))) : 100 });
    } else if (action.action === 'freehand') options.onPreview(gesture.points);
  };
  const update = event => {
    const options = getOptions(), point = pixel(event), coordinate = adapter.unproject(point);
    if (gesture.action === 'freehand') {
      if (Math.hypot(point.x - gesture.lastPixel.x, point.y - gesture.lastPixel.y) < 4) return;
      gesture.points.push(coordinate); gesture.lastPixel = point;
      if (gesture.points.length > 256) gesture.points = gesture.points.filter((_, i) => i % 2 === 0 || i === gesture.points.length - 1);
      options.onPreview([...gesture.points]); return;
    }
    try {
      let next;
      if (gesture.action === 'circle') next = { ...gesture.center, radius: Math.max(100, Math.min(MAX_SEARCH_RADIUS_METERS, distanceMeters(gesture.center, coordinate))) };
      else if (gesture.action === 'resize') next = resizeArea(gesture.original, gesture.handle, coordinate);
      else { const center = areaCenter(gesture.original); next = translateArea(gesture.original, { lng: center.lng + coordinate.lng - gesture.start.lng, lat: center.lat + coordinate.lat - gesture.start.lat }); }
      options.onAreaChange(next); options.onError('');
    } catch (error) { options.onError(error.message); }
  };
  const move = event => {
    const options = getOptions(); ensureDrawingSnapshot(options);
    if (gesture && event.pointerId === gesture.pointer) {
      event.preventDefault(); event.stopImmediatePropagation(); update(event);
    } else if (options.enabled) {
      const action = hit(pixel(event), event.target);
      host.style.cursor = options.drawing ? 'crosshair' : action?.action === 'move' ? 'move' : action ? 'nwse-resize' : '';
    }
  };
  const up = event => {
    if (!gesture || event.pointerId !== gesture.pointer) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const options = getOptions(), action = gesture.action;
    update(event);
    if (action === 'circle') {
      const dragged = Math.hypot(pixel(event).x - gesture.startPixel.x, pixel(event).y - gesture.startPixel.y) >= 6;
      if (tappedCenter || dragged) { options.onDrawingChange(false); tappedCenter = null; drawingMode = null; }
      else tappedCenter = gesture.center;
    } else if (action === 'freehand') {
      try { options.onAreaChange(createFreehandArea(gesture.points)); options.onError(''); }
      catch (error) { options.onAreaChange(originalDrawingArea); options.onError(error.message); }
      options.onDrawingChange(false); drawingMode = null;
    }
    finish();
  };
  const key = event => { if (event.key === 'Escape') { ensureDrawingSnapshot(getOptions()); cancel(); } };
  const click = event => {
    if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false; }
  };
  const cancelEvent = event => { if (gesture && event.pointerId === gesture.pointer) cancel(); };
  host.addEventListener('pointerdown', down, true); host.addEventListener('pointermove', move, true);
  host.addEventListener('pointerup', up, true); host.addEventListener('pointercancel', cancelEvent, true); host.addEventListener('click', click, true);
  window.addEventListener('keydown', key);
  return () => {
    finish();
    host.removeEventListener('pointerdown', down, true); host.removeEventListener('pointermove', move, true);
    host.removeEventListener('pointerup', up, true); host.removeEventListener('pointercancel', cancelEvent, true); host.removeEventListener('click', click, true);
    window.removeEventListener('keydown', key);
  };
}
