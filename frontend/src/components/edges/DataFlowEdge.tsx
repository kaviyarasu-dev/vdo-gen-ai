import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
} from '@xyflow/react';
import { EdgeLabel } from './EdgeLabel';
import { DATA_TYPE_COLORS, type DataType } from '@/types/node.types';

type EdgeStatus = 'idle' | 'active' | 'complete';

type DataFlowEdgeProps = {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: import('@xyflow/react').Position;
  targetPosition: import('@xyflow/react').Position;
  data?: {
    dataType?: DataType;
    isAnimated?: boolean;
    label?: string;
    status?: EdgeStatus;
  };
  selected?: boolean;
};

function getEdgeColor(dataType: DataType, status: EdgeStatus): string {
  if (status === 'complete') return '#22c55e';
  if (status === 'active') return DATA_TYPE_COLORS[dataType];
  return DATA_TYPE_COLORS[dataType];
}

function getEdgeOpacity(status: EdgeStatus, isSelected: boolean): number {
  if (isSelected) return 1;
  if (status === 'active') return 1;
  if (status === 'complete') return 0.85;
  return 0.7;
}

export const DataFlowEdge = memo(function DataFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: DataFlowEdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const dataType: DataType = data?.dataType ?? 'any';
  const isAnimated = data?.isAnimated ?? false;
  const status: EdgeStatus = data?.status ?? 'idle';
  const isActive = status === 'active' || isAnimated;
  const color = getEdgeColor(dataType, status);
  const opacity = getEdgeOpacity(status, selected ?? false);

  return (
    <>
      {/* Glow layer for active edges */}
      {isActive && (
        <BaseEdge
          id={`${id}-glow`}
          path={edgePath}
          style={{
            stroke: color,
            strokeWidth: 6,
            opacity: 0.15,
            filter: 'blur(3px)',
          }}
        />
      )}

      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: selected ? 3 : 2,
          opacity,
          transition: 'stroke 0.3s, opacity 0.3s',
        }}
      />

      {/* Animated flowing dots for active edges */}
      {isActive && (
        <>
          <circle r="3.5" fill={color}>
            <animateMotion
              dur="1.5s"
              repeatCount="indefinite"
              path={edgePath}
            />
          </circle>
          <circle r="2.5" fill={color} opacity="0.5">
            <animateMotion
              dur="1.5s"
              repeatCount="indefinite"
              path={edgePath}
              begin="0.5s"
            />
          </circle>
        </>
      )}

      {/* Completion checkmark dot for completed edges */}
      {status === 'complete' && !isActive && (
        <circle r="3" fill="#22c55e" className="edge-flow-dot">
          <animateMotion
            dur="0.8s"
            repeatCount="1"
            fill="freeze"
            path={edgePath}
          />
        </circle>
      )}

      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
          >
            <EdgeLabel label={data.label} dataType={dataType} />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
