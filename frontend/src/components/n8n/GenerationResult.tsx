import { useState, useCallback, type ReactNode } from 'react';
import { ExternalLink, Copy, CheckCircle, Hash, Link2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import type { VideoGenerationResponse } from '@/types/n8n.types';

type GenerationResultProps = {
  response: VideoGenerationResponse;
  className?: string;
};

export function GenerationResult({ response, className }: GenerationResultProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
        <CheckCircle className="h-5 w-5 text-green-500" />
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          Generation Started
        </span>
        <Badge variant="success">202 Accepted</Badge>
      </div>

      <div className="p-5">
        <Tabs
          tabs={[
            {
              id: 'formatted',
              label: 'Formatted',
              content: <FormattedView response={response} />,
            },
            {
              id: 'json',
              label: 'Raw JSON',
              content: <JsonView response={response} />,
            },
          ]}
          defaultTab="formatted"
        />
      </div>
    </div>
  );
}

function FormattedView({ response }: { response: VideoGenerationResponse }) {
  return (
    <div className="space-y-3">
      <InfoRow
        icon={<CheckCircle className="h-4 w-4 text-green-500" />}
        label="Message"
        value={response.message}
      />
      <InfoRow
        icon={<Hash className="h-4 w-4 text-blue-500" />}
        label="Execution ID"
        value={response.execution_id}
        isCopyable
      />
      <InfoRow
        icon={<Link2 className="h-4 w-4 text-purple-500" />}
        label="n8n Execution URL"
        value={response.n8n_url}
        isLink
        isCopyable
      />
      <InfoRow
        icon={<Link2 className="h-4 w-4 text-orange-500" />}
        label="Status URL"
        value={response.status_url}
        isLink
        isCopyable
      />
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  isLink = false,
  isCopyable = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  isLink?: boolean;
  isCopyable?: boolean;
}) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [value]);

  return (
    <div className="flex items-start gap-3 rounded-md bg-gray-50 px-4 py-3 dark:bg-gray-900/50">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        {isLink ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 break-all text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            {value}
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : (
          <p className="break-all font-mono text-sm text-gray-900 dark:text-gray-100">{value}</p>
        )}
      </div>
      {isCopyable && (
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            'shrink-0 rounded p-1 text-gray-400 transition-colors hover:text-gray-600',
            'dark:hover:text-gray-300',
          )}
          aria-label={`Copy ${label}`}
        >
          {isCopied ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  );
}

function JsonView({ response }: { response: VideoGenerationResponse }) {
  const [isCopied, setIsCopied] = useState(false);
  const jsonString = JSON.stringify(response, null, 2);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(jsonString);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [jsonString]);

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="ghost"
        type="button"
        onClick={handleCopy}
        className="absolute right-2 top-2"
      >
        {isCopied ? (
          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        {isCopied ? 'Copied' : 'Copy'}
      </Button>
      <pre
        className={cn(
          'overflow-auto rounded-lg bg-gray-900 p-4 text-xs text-green-400',
          'font-mono leading-relaxed',
          'max-h-[400px]',
        )}
      >
        {jsonString}
      </pre>
    </div>
  );
}
