import { memo, useEffect, useRef, useState, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Trash2,
  Filter,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { JsonTreeViewer } from '@/components/ui/JsonTreeViewer';
import { cn } from '@/lib/cn';
import { useExecutionStore } from '@/stores/slices/executionSlice';
import { useUIStore } from '@/stores/useUIStore';
import type { ExecutionLogEntry } from '@/types/socket.types';

type LogLevelFilter = 'all' | 'info' | 'warn' | 'error' | 'success';

const LEVEL_ICONS: Record<ExecutionLogEntry['level'], React.ReactNode> = {
  info: <Info className="h-3.5 w-3.5 text-blue-500" />,
  warn: <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />,
  error: <AlertCircle className="h-3.5 w-3.5 text-red-500" />,
  success: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
};

const LEVEL_COLORS: Record<ExecutionLogEntry['level'], string> = {
  info: 'text-gray-600 dark:text-gray-300',
  warn: 'text-yellow-700 dark:text-yellow-300',
  error: 'text-red-600 dark:text-red-400',
  success: 'text-green-700 dark:text-green-300',
};

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

type LogEntryRowProps = {
  entry: ExecutionLogEntry;
};

const LogEntryRow = memo(function LogEntryRow({ entry }: LogEntryRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasData = !!entry.data && Object.keys(entry.data).length > 0;

  return (
    <div
      className={cn(
        'px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-750',
        LEVEL_COLORS[entry.level],
      )}
    >
      {/* Main log line */}
      <div className="flex items-start gap-2">
        {/* Expand toggle — only for entries with data */}
        {hasData ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-0.5 shrink-0 rounded p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="mt-0.5 shrink-0">{LEVEL_ICONS[entry.level]}</span>
        )}

        <span className="shrink-0 font-mono text-gray-400 dark:text-gray-500">
          {formatTimestamp(entry.timestamp)}
        </span>
        {entry.nodeId && (
          <span className="shrink-0 rounded bg-gray-100 px-1 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-gray-700 dark:text-gray-400">
            {entry.nodeLabel ?? entry.nodeId}
          </span>
        )}
        <span className="min-w-0 break-words">{entry.message}</span>

        {/* Data indicator when collapsed */}
        {hasData && !isExpanded && (
          <span className="shrink-0 rounded bg-blue-50 px-1 py-0.5 text-[10px] text-blue-500 dark:bg-blue-900/20 dark:text-blue-400">
            output
          </span>
        )}
      </div>

      {/* Expandable JSON tree */}
      {hasData && isExpanded && (
        <div className="ml-6 mt-1.5 rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-900/50">
          <JsonTreeViewer data={entry.data} defaultExpanded maxDepth={2} />
        </div>
      )}
    </div>
  );
});

export const ExecutionLogPanel = memo(function ExecutionLogPanel() {
  const isOpen = useUIStore((s) => s.executionLogOpen);
  const toggleExecutionLog = useUIStore((s) => s.toggleExecutionLog);
  const logs = useExecutionStore((s) => s.logs);
  const clearLogs = useExecutionStore((s) => s.clearLogs);
  const executionStatus = useExecutionStore((s) => s.executionStatus);

  const [levelFilter, setLevelFilter] = useState<LogLevelFilter>('all');
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  const filteredLogs =
    levelFilter === 'all'
      ? logs
      : logs.filter((l) => l.level === levelFilter);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (shouldAutoScroll.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs.length]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // Auto-scroll if user is near the bottom (within 40px)
    shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 40;
  }, []);

  const logCount = logs.length;
  const hasErrors = logs.some((l) => l.level === 'error');

  return (
    <div
      className={cn(
        'border-t border-gray-200 bg-white transition-all dark:border-gray-700 dark:bg-gray-800',
        isOpen ? 'h-64' : 'h-9',
      )}
      role="region"
      aria-label="Execution log"
    >
      {/* Screen reader announcement for status changes */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {executionStatus !== 'idle' && `Execution ${executionStatus}`}
      </div>
      {/* Header bar */}
      <div
        className="flex h-9 cursor-pointer items-center justify-between px-3"
        onClick={toggleExecutionLog}
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          )}
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
            Execution Log
          </span>
          {logCount > 0 && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                hasErrors
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
              )}
            >
              {logCount}
            </span>
          )}
          {executionStatus !== 'idle' && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize',
                executionStatus === 'running' &&
                  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                executionStatus === 'completed' &&
                  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                executionStatus === 'failed' &&
                  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                executionStatus === 'paused' &&
                  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                executionStatus === 'cancelled' &&
                  'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
              )}
            >
              {executionStatus}
            </span>
          )}
        </div>

        {isOpen && (
          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Level filter */}
            <div className="flex items-center gap-0.5 rounded-md border border-gray-200 p-0.5 dark:border-gray-600">
              <Filter className="ml-1 h-3 w-3 text-gray-400" />
              {(['all', 'info', 'warn', 'error', 'success'] as const).map(
                (level) => (
                  <button
                    key={level}
                    onClick={() => setLevelFilter(level)}
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-medium capitalize transition-colors',
                      levelFilter === level
                        ? 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-white'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
                    )}
                  >
                    {level}
                  </button>
                ),
              )}
            </div>
            {/* Clear button */}
            <button
              onClick={clearLogs}
              title="Clear logs"
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Log entries */}
      {isOpen && (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-[calc(100%-2.25rem)] overflow-y-auto scrollbar-thin"
        >
          {filteredLogs.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-gray-400 dark:text-gray-500">
              {logCount === 0
                ? 'No execution logs yet. Run a workflow to see output.'
                : 'No logs match the current filter.'}
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {filteredLogs.map((entry) => (
                <LogEntryRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
