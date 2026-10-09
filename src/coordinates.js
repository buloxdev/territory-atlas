export const coordinate = value =>
  value == null || (typeof value === 'string' && value.trim() === '') ? NaN : Number(value);

export const hasMapCoordinates = location =>
  Number.isFinite(coordinate(location.lat)) &&
  Number.isFinite(coordinate(location.lng)) &&
  Math.abs(coordinate(location.lat)) <= 85;
