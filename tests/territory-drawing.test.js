import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutTerritoryDrawing } from '../src/territory-drawing.js';
import { DEMO_LOCATIONS } from '../src/locations.js';

test('demo territory gets one numbered balloon per location, split across both gutters', () => {
  const drawing = layoutTerritoryDrawing(DEMO_LOCATIONS, { width: 564, height: 500 });
  assert.equal(drawing.balloons.length, DEMO_LOCATIONS.length);
  assert.deepEqual(drawing.balloons.map(b => b.number).sort((a, b) => a - b), DEMO_LOCATIONS.map((_, i) => i + 1));
  const left = drawing.balloons.filter(b => b.side === 'left'), right = drawing.balloons.filter(b => b.side === 'right');
  assert.equal(left.length, 5); assert.equal(right.length, 5);
  for (const side of [left, right]) for (let i = 1; i < side.length; i++) assert.ok(side[i].by > side[i - 1].by, 'balloons stack top to bottom');
  assert.ok(Math.max(...left.map(b => b.x)) <= Math.min(...right.map(b => b.x)), 'western points call out on the left');
});

test('points stay inside the drawing area between the gutters', () => {
  const drawing = layoutTerritoryDrawing(DEMO_LOCATIONS, { width: 564, height: 500, gutter: 120, pad: 36 });
  for (const point of drawing.points) {
    assert.ok(point.x >= 120 && point.x <= 444, `${point.location.city} x in bounds`);
    assert.ok(point.y >= 36 && point.y <= 464, `${point.location.city} y in bounds`);
  }
  assert.deepEqual(drawing.counts, { customers: 4, prospects: 6, unplaced: 0 });
  assert.equal(drawing.highlight.location.id, DEMO_LOCATIONS[0].id);
  assert.ok(drawing.highlight.radius > 0 && drawing.scaleBar.length > 0);
});

test('unplaced and empty territories still produce a drawing', () => {
  const drawing = layoutTerritoryDrawing([{ id: 'x', company: 'No coords', status: 'Prospect', lat: '', lng: null }]);
  assert.equal(drawing.points.length, 0);
  assert.equal(drawing.balloons.length, 0);
  assert.equal(drawing.highlight, null);
  assert.equal(drawing.counts.unplaced, 1);
  assert.ok(drawing.states.length > 0);
});

test('large territories cap callouts but keep every point', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, company: `Co ${i}`, status: i % 2 ? 'Customer' : 'Prospect', lat: 40 + i * 0.1, lng: -90 + i * 0.2 }));
  const drawing = layoutTerritoryDrawing(many);
  assert.equal(drawing.points.length, 30);
  assert.equal(drawing.balloons.length, 12);
});
