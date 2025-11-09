export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalize(x: number, y: number): { x: number; y: number } {
  const length = Math.sqrt(x * x + y * y);
  
  if (length === 0) {
    return { x: 0, y: 0 };
  }
  
  return {
    x: x / length,
    y: y / length
  };
}