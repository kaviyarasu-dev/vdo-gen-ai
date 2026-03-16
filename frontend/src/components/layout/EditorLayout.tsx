import { ReactFlowProvider } from '@xyflow/react';
import { NodePalette } from '@/components/workflow/NodePalette';
import { WorkflowCanvas } from '@/components/workflow/WorkflowCanvas';
import { NodeConfigPanel } from '@/components/panels/NodeConfigPanel';
import { ErrorBoundary, CanvasErrorFallback } from '@/components/ui/ErrorBoundary';
import type { SaveStatus } from '@/hooks/useAutoSave';

type EditorLayoutProps = {
  saveStatus?: SaveStatus;
};

export function EditorLayout({ saveStatus = 'idle' }: EditorLayoutProps) {
  return (
    <ReactFlowProvider>
      <div className="flex h-full">
        {/* NodePalette hidden on mobile, icon-only on tablet via internal responsive */}
        <NodePalette />
        <ErrorBoundary fallback={<CanvasErrorFallback />}>
          <WorkflowCanvas className="flex-1" saveStatus={saveStatus} />
        </ErrorBoundary>
        <ErrorBoundary>
          <NodeConfigPanel />
        </ErrorBoundary>
      </div>
    </ReactFlowProvider>
  );
}
