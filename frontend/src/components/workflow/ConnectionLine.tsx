import { type ConnectionLineComponentProps } from '@xyflow/react';

export function ConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
}: ConnectionLineComponentProps) {
  return (
    <g>
      <path
        fill="none"
        stroke="#3b82f6"
        strokeWidth={2}
        strokeDasharray="5 5"
        d={`M${fromX},${fromY} C${fromX + 80},${fromY} ${toX - 80},${toY} ${toX},${toY}`}
      />
      <circle
        cx={toX}
        cy={toY}
        fill="#3b82f6"
        r={4}
        stroke="#ffffff"
        strokeWidth={2}
      />
    </g>
  );
}
