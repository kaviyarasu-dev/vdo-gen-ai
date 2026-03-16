import { useCallback, useRef, useState, type DragEvent } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type ReactFlowInstance,
  type NodeMouseHandler,
} from '@xyflow/react';
import { cn } from '@/lib/cn';
import { nodeTypes } from '@/config/nodeTypes';
import { edgeTypes } from '@/config/edgeTypes';
import { useWorkflowStore } from '@/stores/useWorkflowStore';
import { useExecutionStore } from '@/stores/slices/executionSlice';
import { useNodeValidation } from '@/hooks/useNodeValidation';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ConnectionLine } from './ConnectionLine';
import { WorkflowToolbar } from './WorkflowToolbar';
import { CanvasContextMenu } from './CanvasContextMenu';
import { ExecutionLogPanel } from '@/components/panels/ExecutionLogPanel';
import { CATEGORY_COLORS, type BaseNodeData } from '@/types/node.types';
import type { VdoNode } from '@/types/node.types';
import type { VdoEdge } from '@/types/edge.types';

import type { SaveStatus } from '@/hooks/useAutoSave';

import '@/styles/reactflow.css';

type ContextMenuState = {
  x: number;
  y: number;
  canvasPosition: { x: number; y: number };
  nodeId: string | null;
} | null;

type WorkflowCanvasProps = {
  className?: string;
  saveStatus?: SaveStatus;
};

export function WorkflowCanvas({ className, saveStatus = 'idle' }: WorkflowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance<VdoNode, VdoEdge> | null>(null);
  const [contextMenu, setContextMenu] =
    useState<ContextMenuState>(null);

  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const onNodesChange = useWorkflowStore((s) => s.onNodesChange);
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
  const onConnect = useWorkflowStore((s) => s.onConnect);
  const addNode = useWorkflowStore((s) => s.addNode);
  const setSelectedNode = useWorkflowStore((s) => s.setSelectedNode);

  const executionStatus = useExecutionStore((s) => s.executionStatus);
  const isExecuting = executionStatus === 'running';

  const { isValidConnection } = useNodeValidation();
  useKeyboardShortcuts();

  const onNodeClick: NodeMouseHandler<VdoNode> = useCallback(
    (_event, node) => {
      setSelectedNode(node.id);
    },
    [setSelectedNode],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setContextMenu(null);
  }, [setSelectedNode]);

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData(
        'application/vdo-node-type',
      );
      if (!type || !reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      addNode(type, position);
    },
    [reactFlowInstance, addNode],
  );

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!reactFlowInstance) return;

      const canvasPosition = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        canvasPosition,
        nodeId: null,
      });
    },
    [reactFlowInstance],
  );

  const onNodeContextMenu: NodeMouseHandler<VdoNode> = useCallback(
    (e, node) => {
      e.preventDefault();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        canvasPosition: node.position,
        nodeId: node.id,
      });
    },
    [],
  );

  const minimapNodeColor = useCallback((node: VdoNode) => {
    const data = node.data as BaseNodeData;
    return CATEGORY_COLORS[data.category]?.light ?? '#6b7280';
  }, []);

  return (
    <div
      ref={reactFlowWrapper}
      className={cn('flex h-full flex-col', className)}
    >
      <WorkflowToolbar saveStatus={saveStatus} />
      <div className="relative flex-1">
        <ReactFlow<VdoNode, VdoEdge>
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onContextMenu={onContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionLineComponent={ConnectionLine}
          isValidConnection={isValidConnection}
          defaultEdgeOptions={{
            type: 'dataFlow',
            animated: false,
          }}
          nodesDraggable={!isExecuting}
          nodesConnectable={!isExecuting}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          snapToGrid
          snapGrid={[20, 20]}
          minZoom={0.1}
          maxZoom={2}
          nodeExtent={[[-5000, -5000], [5000, 5000]]}
          selectNodesOnDrag={false}
          deleteKeyCode={null}
          multiSelectionKeyCode="Shift"
          className="bg-gray-50 dark:bg-[#1a1a2e]"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#d1d5db"
            className="dark:!bg-[#1a1a2e]"
          />
          <Controls
            showInteractive={false}
            position="bottom-left"
          />
          <MiniMap
            nodeColor={minimapNodeColor}
            maskColor="rgb(59 130 246 / 0.1)"
            position="bottom-right"
            pannable
            zoomable
          />
        </ReactFlow>

        {contextMenu && (
          <CanvasContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            canvasPosition={contextMenu.canvasPosition}
            nodeId={contextMenu.nodeId}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
      <ExecutionLogPanel />
    </div>
  );
}
