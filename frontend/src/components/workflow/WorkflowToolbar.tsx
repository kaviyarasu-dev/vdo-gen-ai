import { memo, useCallback, useRef } from 'react';
import {
  Play,
  Square,
  Save,
  Undo2,
  Redo2,
  Loader2,
  Check,
  RotateCcw,
  Terminal,
  WifiOff,
  Download,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useWorkflowStore } from '@/stores/useWorkflowStore';
import { useExecutionStore } from '@/stores/slices/executionSlice';
import { useUIStore } from '@/stores/useUIStore';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { useWorkflowExecution } from '@/hooks/useWorkflowExecution';
import { useNotificationStore } from '@/stores/useNotificationStore';
import type { WorkflowExportData } from '@/types/template.types';
import type { SaveStatus } from '@/hooks/useAutoSave';

type ToolbarButtonProps = {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  isDisabled?: boolean;
  variant?: 'default' | 'primary' | 'danger' | 'warning';
};

function ToolbarButton({
  icon,
  label,
  onClick,
  isDisabled = false,
  variant = 'default',
}: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      title={label}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'primary' &&
          'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
        variant === 'danger' &&
          'bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600',
        variant === 'warning' &&
          'bg-orange-500 text-white hover:bg-orange-600 dark:bg-orange-500 dark:hover:bg-orange-600',
        variant === 'default' &&
          'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700',
      )}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

function ToolbarDivider() {
  return (
    <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-600" />
  );
}

type SaveIndicatorProps = {
  saveStatus: SaveStatus;
};

function SaveIndicator({ saveStatus }: SaveIndicatorProps) {
  if (saveStatus === 'idle') return null;

  return (
    <span
      className={cn(
        'flex items-center gap-1 text-xs',
        saveStatus === 'saving' && 'text-blue-500',
        saveStatus === 'saved' && 'text-green-500',
        saveStatus === 'error' && 'text-red-500',
      )}
    >
      {saveStatus === 'saving' && (
        <>
          <Loader2 size={12} className="animate-spin" />
          <span>Saving...</span>
        </>
      )}
      {saveStatus === 'saved' && (
        <>
          <Check size={12} />
          <span>Saved</span>
        </>
      )}
      {saveStatus === 'error' && <span>Save failed</span>}
    </span>
  );
}

function ExecutionStatusBadge() {
  const executionStatus = useExecutionStore((s) => s.executionStatus);
  const overallProgress = useExecutionStore((s) => s.overallProgress);

  if (executionStatus === 'idle') return null;

  return (
    <div className="flex items-center gap-1.5">
      {executionStatus === 'running' && (
        <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          <Loader2 size={10} className="animate-spin" />
          {Math.round(overallProgress)}%
        </span>
      )}
      {executionStatus === 'completed' && (
        <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <Check size={10} />
          Completed
        </span>
      )}
      {executionStatus === 'failed' && (
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
          Failed
        </span>
      )}
      {executionStatus === 'paused' && (
        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
          Paused
        </span>
      )}
      {executionStatus === 'cancelled' && (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          Cancelled
        </span>
      )}
    </div>
  );
}

function SocketIndicator() {
  const socketStatus = useExecutionStore((s) => s.socketStatus);

  if (socketStatus === 'connected') return null;

  return (
    <div
      className={cn(
        'flex items-center gap-1 text-[10px] font-medium',
        socketStatus === 'disconnected' && 'text-red-500 socket-disconnect-indicator',
        socketStatus === 'reconnecting' && 'text-yellow-500',
      )}
      title={
        socketStatus === 'disconnected'
          ? 'WebSocket disconnected'
          : 'Reconnecting to server...'
      }
    >
      <WifiOff size={10} />
      <span className="hidden md:inline">
        {socketStatus === 'disconnected' ? 'Offline' : 'Reconnecting...'}
      </span>
    </div>
  );
}

type WorkflowToolbarProps = {
  saveStatus?: SaveStatus;
};

export const WorkflowToolbar = memo(function WorkflowToolbar({
  saveStatus = 'idle',
}: WorkflowToolbarProps) {
  const workflowName = useWorkflowStore((s) => s.workflowName);
  const isDirty = useWorkflowStore((s) => s.isDirty);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const loadWorkflow = useWorkflowStore((s) => s.loadWorkflow);
  const toggleExecutionLog = useUIStore((s) => s.toggleExecutionLog);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    isRunning,
    isFailed,
    isCompleted,
    isStarting,
    isCancelling,
    startExecution,
    stopExecution,
    retryExecution,
    resetWorkflow,
  } = useWorkflowExecution();

  const handleExport = useCallback(() => {
    const exportData: WorkflowExportData = {
      name: workflowName,
      nodes,
      edges,
      version: 1,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowName.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addNotification({
      type: 'success',
      title: 'Workflow exported',
    });
  }, [workflowName, nodes, edges, addNotification]);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string) as WorkflowExportData;
          if (!parsed.nodes || !parsed.edges || !Array.isArray(parsed.nodes)) {
            throw new Error('Invalid format');
          }
          loadWorkflow(parsed.nodes, parsed.edges, {
            id: '',
            name: parsed.name || 'Imported Workflow',
          });
          addNotification({
            type: 'success',
            title: 'Workflow imported',
            message: `"${parsed.name}" has been loaded.`,
          });
        } catch {
          addNotification({
            type: 'error',
            title: 'Import failed',
            message: 'The file is not a valid workflow JSON.',
          });
        }
      };
      reader.readAsText(file);
      // Reset so the same file can be re-selected
      e.target.value = '';
    },
    [loadWorkflow, addNotification],
  );

  function renderExecutionButton() {
    if (isRunning) {
      return (
        <ToolbarButton
          icon={
            isCancelling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Square className="h-4 w-4" />
            )
          }
          label="Stop"
          onClick={stopExecution}
          isDisabled={isCancelling}
          variant="danger"
        />
      );
    }

    if (isFailed) {
      return (
        <>
          <ToolbarButton
            icon={<RotateCcw className="h-4 w-4" />}
            label="Retry"
            onClick={retryExecution}
            variant="warning"
          />
          <ToolbarButton
            icon={<Play className="h-4 w-4" />}
            label="Run Again"
            onClick={() => {
              resetWorkflow();
              startExecution();
            }}
            variant="primary"
          />
        </>
      );
    }

    if (isCompleted) {
      return (
        <ToolbarButton
          icon={<Play className="h-4 w-4" />}
          label="Run Again"
          onClick={() => {
            resetWorkflow();
            startExecution();
          }}
          variant="primary"
        />
      );
    }

    return (
      <ToolbarButton
        icon={
          isStarting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )
        }
        label="Run Workflow"
        onClick={startExecution}
        isDisabled={isStarting}
        variant="primary"
      />
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-gray-200 bg-white px-3 py-1.5',
        'dark:border-gray-700 dark:bg-gray-800',
      )}
    >
      {/* Left section: workflow name + save status + socket indicator */}
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          {workflowName}
        </h2>
        {isDirty && saveStatus !== 'saving' && (
          <span className="h-2 w-2 rounded-full bg-orange-400" title="Unsaved changes" />
        )}
        <SaveIndicator saveStatus={saveStatus} />
        <ExecutionStatusBadge />
        <SocketIndicator />
      </div>

      {/* Center section: tools */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          icon={<Undo2 className="h-4 w-4" />}
          label="Undo"
          onClick={undo}
          isDisabled={!canUndo}
        />
        <ToolbarButton
          icon={<Redo2 className="h-4 w-4" />}
          label="Redo"
          onClick={redo}
          isDisabled={!canRedo}
        />
      </div>

      {/* Right section: actions */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          icon={<Upload className="h-4 w-4" />}
          label="Import"
          onClick={() => fileInputRef.current?.click()}
        />
        <ToolbarButton
          icon={<Download className="h-4 w-4" />}
          label="Export"
          onClick={handleExport}
          isDisabled={nodes.length === 0}
        />
        <ToolbarDivider />
        <ToolbarButton
          icon={<Terminal className="h-4 w-4" />}
          label="Logs"
          onClick={toggleExecutionLog}
        />
        <ToolbarButton
          icon={<Save className="h-4 w-4" />}
          label="Save"
          onClick={() => {
            document.dispatchEvent(
              new KeyboardEvent('keydown', { key: 's', metaKey: true }),
            );
          }}
          isDisabled={!isDirty}
        />
        {renderExecutionButton()}
      </div>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImport}
        className="hidden"
      />

    </div>
  );
});
