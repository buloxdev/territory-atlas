import React, { useId, useMemo } from 'react';
import { layoutTerritoryDrawing } from './territory-drawing.js';

const RULER_WIDTH = 3840, RULER_STEP = 20, RULER_LABEL = 160;

// A 22px pixel ruler; labels count real pixels from the left edge every four grid cells.
export function Ruler() {
  const ticks = useMemo(() => {
    const minor = [], major = [], label = [];
    for (let x = 0; x <= RULER_WIDTH; x += RULER_STEP) {
      if (x % RULER_LABEL === 0) label.push(x);
      else if (x % (RULER_STEP * 2) === 0) major.push(x);
      else minor.push(x);
    }
    const path = (list, height) => list.map(x => `M${x + .5} 22v-${height}`).join('');
    return { minor: path(minor, 5), major: path(major, 9), label: path(label, 14), labels: label };
  }, []);
  return <div className="bp-ruler" aria-hidden="true">
    <svg width={RULER_WIDTH} height="22" viewBox={`0 0 ${RULER_WIDTH} 22`}>
      <path d={ticks.minor} className="bp-ruler-minor"/><path d={ticks.major} className="bp-ruler-major"/><path d={ticks.label} className="bp-ruler-label"/>
      {ticks.labels.map(x => <text key={x} x={x + 4} y="9">{x}</text>)}
    </svg>
  </div>;
}

export const Crosshair = ({ className = '' }) => <svg className={`bp-glyph ${className}`} width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="5"/><path d="M9 0V18M0 9H18"/></svg>;

export const Crosses = () => <>{['tl', 'tr', 'bl', 'br'].map(corner => <span key={corner} className={`bp-cross ${corner}`} aria-hidden="true"/>)}</>;

export function SheetHead({ number, title, note, as: Heading = 'h2', id }) {
  return <div className="bp-sheet-head"><span className="bp-sheet-no">{number}</span><Heading id={id}>{title}</Heading>{note && <span className="bp-sheet-note">{note}</span>}</div>;
}

export function TitleBlock({ rows }) {
  return <dl className="bp-titleblock">{rows.map(([term, value, flagged]) => <div key={term}><dt>{term}</dt><dd className={flagged ? 'is-flagged' : ''}>{value}</dd></div>)}</dl>;
}

// The product drawn as line-work: schematic state outlines, numbered callouts, one hatched search area.
export function TerritoryDrawing({ locations, label = 'DETAIL A' }) {
  const hatchId = `bp-hatch-${useId().replace(/:/g, '')}`;
  const drawing = useMemo(() => layoutTerritoryDrawing(locations), [locations]);
  const { width, height, highlight } = drawing;
  const status = point => point.customer ? 'CUSTOMER' : 'PROSPECT';
  return <svg className="bp-drawing" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Schematic drawing of ${drawing.points.length} locations: ${drawing.counts.customers} customers and ${drawing.counts.prospects} prospects`}>
    <defs><pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)"><path d="M0 0V6" className="bp-hatch"/></pattern></defs>
    <text className="bp-drawing-caption" x="16" y="24">{label}</text>
    <g className="bp-states">{drawing.states.map(state => <path key={state.code} d={state.d}/>)}</g>
    <g className="bp-state-labels">{drawing.labels.map(state => <text key={state.code} x={state.x} y={state.y}>{state.name}</text>)}</g>
    {highlight && <g className="bp-search-area">
      <circle cx={highlight.x} cy={highlight.y} r={highlight.radius} fill={`url(#${hatchId})`}/>
      <path d={`M${highlight.x} ${highlight.y}H${highlight.x - highlight.radius}M${highlight.x} ${highlight.y - 4}v8M${highlight.x - highlight.radius} ${highlight.y - 4}v8`}/>
      <text x={highlight.x} y={highlight.y + highlight.radius + 13}>R {highlight.miles} MI</text>
    </g>}
    <g className="bp-callouts">{drawing.balloons.map(point => {
      const flagged = point === highlight || point.location.id === highlight?.location.id;
      const edge = point.side === 'left' ? point.bx + 9 : point.bx - 9, textX = point.side === 'left' ? point.bx - 15 : point.bx + 15;
      const anchor = point.side === 'left' ? 'end' : 'start';
      return <g key={point.location.id ?? point.number} className={flagged ? 'is-flagged' : ''}>
        <path className="bp-leader" d={`M${point.x} ${point.y}L${edge} ${point.by}`}/>
        <circle className="bp-balloon" cx={point.bx} cy={point.by} r="9"/>
        <text className="bp-balloon-no" x={point.bx} y={point.by + 3.2}>{point.number}</text>
        <text className="bp-callout-name" x={textX} y={point.by - 2} textAnchor={anchor}>{String(point.location.city || point.location.company).toUpperCase()}</text>
        <text className="bp-callout-status" x={textX} y={point.by + 9} textAnchor={anchor}>{status(point)}</text>
      </g>;
    })}</g>
    <g className="bp-points">{drawing.points.map(point => <circle key={point.location.id ?? point.number} className={point.customer ? 'is-customer' : 'is-prospect'} cx={point.x} cy={point.y} r="3.5"/>)}</g>
    <g className="bp-scale" transform={`translate(24 ${height - 18})`}>
      <rect x="0" y="-2" width={drawing.scaleBar.length / 2} height="4"/>
      <path d={`M0 0H${drawing.scaleBar.length}M0 -4v8M${drawing.scaleBar.length / 2} -4v8M${drawing.scaleBar.length} -4v8`}/>
      <text x="0" y="-8">0</text><text x={drawing.scaleBar.length} y="-8">{drawing.scaleBar.miles} MI</text>
    </g>
    <g className="bp-north" transform={`translate(${width - 28} ${height - 44})`}><path d="M0 0L6 18L0 14L-6 18Z"/><text x="0" y="30">N</text></g>
  </svg>;
}

export function drawingCounts(locations) {
  const customers = locations.filter(location => location.status === 'Customer').length;
  return `${customers} CUST · ${locations.length - customers} PROS`;
}
