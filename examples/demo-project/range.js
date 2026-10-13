export function clamp(value, min, max) {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(min) ||
    !Number.isFinite(max)
  ) {
    throw new TypeError('All arguments (value, min, max) must be finite numbers.');
  }

  if (min > max) {
    throw new RangeError('min must be less than or equal to max.');
  }

  return Math.min(max, Math.max(min, value));
}
