export function circleRectAABBCollision(
  circleX: number,
  circleY: number,
  circleRadius: number,
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number
): boolean {
  const closestX = Math.max(rectX, Math.min(circleX, rectX + rectWidth));
  const closestY = Math.max(rectY, Math.min(circleY, rectY + rectHeight));

  const dx = circleX - closestX;
  const dy = circleY - closestY;
  const distanceSquared = dx * dx + dy * dy;

  return distanceSquared < (circleRadius * circleRadius);
}