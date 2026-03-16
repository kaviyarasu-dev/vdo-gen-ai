import { useState, useCallback, memo } from 'react';
import { ChevronRight, ChevronDown, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/cn';

type JsonTreeViewerProps = {
  data: unknown;
  defaultExpanded?: boolean;
  maxDepth?: number;
  className?: string;
};

type JsonNodeProps = {
  label?: string;
  value: unknown;
  depth: number;
  maxDepth: number;
  defaultExpanded: boolean;
};

function getType(value: unknown): 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null' {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'null';
}

const INDENT_PX = 20;

const TruncatedString = memo(({ value }: { value: string }) => {
  const [expanded, setExpanded] = useState(false);
  const shouldTruncate = value.length > 100;

  return (
    <span className="text-green-600 dark:text-green-400">
      &quot;
      {shouldTruncate && !expanded ? (
        <>
          {value.slice(0, 100)}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(true);
            }}
            className="ml-0.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
          >
            ...
          </button>
        </>
      ) : (
        value
      )}
      &quot;
    </span>
  );
});
TruncatedString.displayName = 'TruncatedString';

function renderPrimitive(value: unknown) {
  const type = getType(value);

  switch (type) {
    case 'string':
      return <TruncatedString value={value as string} />;
    case 'number':
      return <span className="text-blue-600 dark:text-blue-400">{String(value)}</span>;
    case 'boolean':
      return <span className="text-purple-600 dark:text-purple-400">{String(value)}</span>;
    case 'null':
      return <span className="italic text-gray-400 dark:text-gray-500">null</span>;
    default:
      return null;
  }
}

const JsonNode = memo(({ label, value, depth, maxDepth, defaultExpanded }: JsonNodeProps) => {
  const type = getType(value);
  const isCollapsible = type === 'object' || type === 'array';
  const [isExpanded, setIsExpanded] = useState(defaultExpanded && depth < maxDepth);

  const toggle = useCallback(() => setIsExpanded((prev) => !prev), []);

  const labelEl = label !== undefined ? (
    <span className="text-gray-700 dark:text-gray-300">{label}: </span>
  ) : null;

  if (!isCollapsible) {
    return (
      <div className="flex items-start" style={{ paddingLeft: depth * INDENT_PX }}>
        {/* spacer to align with chevrons */}
        <span className="inline-block w-4 shrink-0" />
        {labelEl}
        {renderPrimitive(value)}
      </div>
    );
  }

  const isArray = type === 'array';
  const entries = isArray
    ? (value as unknown[])
    : Object.entries(value as Record<string, unknown>);
  const count = isArray ? (value as unknown[]).length : Object.keys(value as object).length;
  const openBracket = isArray ? '[' : '{';
  const closeBracket = isArray ? ']' : '}';
  const collapsedLabel = isArray ? `[ ${count} item${count !== 1 ? 's' : ''} ]` : `{ ${count} key${count !== 1 ? 's' : ''} }`;

  return (
    <div>
      <div
        className="flex items-start cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded"
        style={{ paddingLeft: depth * INDENT_PX }}
        onClick={toggle}
      >
        <span className="inline-flex items-center justify-center w-4 shrink-0 text-gray-500 dark:text-gray-400">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        {labelEl}
        {isExpanded ? (
          <span className="text-gray-500 dark:text-gray-400">{openBracket}</span>
        ) : (
          <span className="text-gray-500 dark:text-gray-400">{collapsedLabel}</span>
        )}
      </div>

      {isExpanded && (
        <>
          {isArray
            ? (entries as unknown[]).map((item, index) => (
                <JsonNode
                  key={index}
                  label={String(index)}
                  value={item}
                  depth={depth + 1}
                  maxDepth={maxDepth}
                  defaultExpanded={defaultExpanded}
                />
              ))
            : (entries as [string, unknown][]).map(([key, val]) => (
                <JsonNode
                  key={key}
                  label={key}
                  value={val}
                  depth={depth + 1}
                  maxDepth={maxDepth}
                  defaultExpanded={defaultExpanded}
                />
              ))}
          <div
            className="text-gray-500 dark:text-gray-400"
            style={{ paddingLeft: depth * INDENT_PX }}
          >
            <span className="inline-block w-4 shrink-0" />
            {closeBracket}
          </div>
        </>
      )}
    </div>
  );
});
JsonNode.displayName = 'JsonNode';

export function JsonTreeViewer({
  data,
  defaultExpanded = false,
  maxDepth = 3,
  className,
}: JsonTreeViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in insecure contexts — silently ignore
    }
  }, [data]);

  return (
    <div
      className={cn(
        'relative rounded-lg border border-gray-200 dark:border-gray-700',
        'bg-gray-50 dark:bg-gray-900',
        'py-3 pl-2 pr-10',
        'font-mono text-sm leading-relaxed',
        'overflow-auto',
        className,
      )}
    >
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          'absolute top-2 right-2 p-1.5 rounded-md',
          'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
          'hover:bg-gray-200 dark:hover:bg-gray-700',
          'transition-colors cursor-pointer',
        )}
        title="Copy JSON"
      >
        {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
      </button>

      <JsonNode
        value={data}
        depth={0}
        maxDepth={maxDepth}
        defaultExpanded={defaultExpanded}
      />
    </div>
  );
}

JsonTreeViewer.displayName = 'JsonTreeViewer';
