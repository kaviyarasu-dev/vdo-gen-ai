import { memo, useCallback, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useWorkflowStore } from '@/stores/useWorkflowStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { getNodeDefinition } from '@/config/nodeRegistry';
import { CATEGORY_COLORS } from '@/types/node.types';
import { useProviderModels } from '@/hooks/useProviders';
import { ProviderSelector } from './ProviderSelector';
import { ModelParameterForm } from './ModelParameterForm';
import { MediaUploader } from '@/components/media/MediaUploader';
import type { ConfigField } from '@/types/node.types';
import type { MediaType } from '@/types/media.types';

const NODE_UPLOAD_CONFIG: Record<string, { types: MediaType[]; label: string }> = {
  scriptInput: { types: ['script'], label: 'Upload Script' },
  imageGenerator: { types: ['image'], label: 'Upload Reference Image' },
  videoGenerator: { types: ['image', 'video'], label: 'Upload Source Media' },
};

type TabId = 'general' | 'provider' | 'config' | 'media';

type NodeConfigPanelProps = {
  className?: string;
};

export const NodeConfigPanel = memo(function NodeConfigPanel({
  className,
}: NodeConfigPanelProps) {
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const nodes = useWorkflowStore((s) => s.nodes);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const setSelectedNode = useWorkflowStore((s) => s.setSelectedNode);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const definition = selectedNode ? getNodeDefinition(selectedNode.data.nodeType) : undefined;

  const hasProviders = (definition?.supportedProviders.length ?? 0) > 0;
  const hasConfigFields = (definition?.configFields.length ?? 0) > 0;
  const hasMediaUpload = selectedNode ? !!NODE_UPLOAD_CONFIG[selectedNode.data.nodeType] : false;

  const availableTabs = useMemo<TabId[]>(() => {
    const tabs: TabId[] = ['general'];
    if (hasProviders) tabs.push('provider');
    if (hasConfigFields) tabs.push('config');
    if (hasMediaUpload) tabs.push('media');
    return tabs;
  }, [hasProviders, hasConfigFields, hasMediaUpload]);

  const [activeTab, setActiveTab] = useState<TabId>('general');

  // Reset to general tab if current tab is no longer available
  const currentTab = availableTabs.includes(activeTab) ? activeTab : 'general';

  const handleConfigChange = useCallback(
    (key: string, value: string | number | boolean) => {
      if (!selectedNodeId || !selectedNode) return;
      updateNodeData(selectedNodeId, {
        config: { ...selectedNode.data.config, [key]: value },
      });
    },
    [selectedNodeId, selectedNode, updateNodeData],
  );

  const handleProviderChange = useCallback(
    (provider: string) => {
      if (!selectedNodeId) return;
      updateNodeData(selectedNodeId, { provider, model: null });
    },
    [selectedNodeId, updateNodeData],
  );

  const handleModelChange = useCallback(
    (model: string) => {
      if (!selectedNodeId) return;
      updateNodeData(selectedNodeId, { model: model || null });
    },
    [selectedNodeId, updateNodeData],
  );

  const handleModelParamChange = useCallback(
    (key: string, value: unknown) => {
      if (!selectedNodeId || !selectedNode) return;
      const modelParams = (selectedNode.data.modelParams ?? {}) as Record<string, unknown>;
      updateNodeData(selectedNodeId, {
        modelParams: { ...modelParams, [key]: value },
      });
    },
    [selectedNodeId, selectedNode, updateNodeData],
  );

  if (!selectedNode) {
    return (
      <div
        className={cn(
          'flex h-full w-[280px] flex-col border-l border-gray-200 bg-white',
          'dark:border-gray-700 dark:bg-gray-800',
          // Hide empty panel on small screens
          'max-lg:hidden',
          className,
        )}
      >
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-center text-sm text-gray-400 dark:text-gray-500">
            Select a node to configure
          </p>
        </div>
      </div>
    );
  }

  if (!definition) return null;

  const categoryColor = CATEGORY_COLORS[selectedNode.data.category];

  const TAB_LABELS: Record<TabId, string> = {
    general: 'General',
    provider: 'Provider',
    config: 'Config',
    media: 'Media',
  };

  return (
    <div
      className={cn(
        'flex h-full w-[280px] flex-col border-l border-gray-200 bg-white',
        'dark:border-gray-700 dark:bg-gray-800',
        // On small screens, overlay as a slide-in panel
        'max-lg:fixed max-lg:right-0 max-lg:top-0 max-lg:z-50 max-lg:h-screen max-lg:shadow-xl',
        'panel-enter-right',
        className,
      )}
      role="complementary"
      aria-label="Node configuration"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: categoryColor.light }}
          />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {selectedNode.data.label}
          </h3>
        </div>
        <button
          onClick={() => setSelectedNode(null)}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      {availableTabs.length > 1 && (
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {availableTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 border-b-2 px-2 py-2 text-[11px] font-medium transition-colors -mb-px',
                currentTab === tab
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300',
              )}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {currentTab === 'general' && (
          <GeneralTab
            description={definition.description}
            nodeLabel={selectedNode.data.label}
            onLabelChange={(label) => {
              if (selectedNodeId) updateNodeData(selectedNodeId, { label });
            }}
          />
        )}

        {currentTab === 'provider' && (
          <ProviderTab
            supportedProviders={definition.supportedProviders}
            selectedProvider={selectedNode.data.provider}
            selectedModel={selectedNode.data.model}
            modelParams={(selectedNode.data.modelParams ?? {}) as Record<string, unknown>}
            onProviderChange={handleProviderChange}
            onModelChange={handleModelChange}
            onModelParamChange={handleModelParamChange}
          />
        )}

        {currentTab === 'config' && (
          <div className="space-y-4">
            {definition.configFields.map((field) => (
              <ConfigFieldRenderer
                key={field.key}
                field={field}
                value={
                  selectedNode.data.config[field.key] ??
                  field.defaultValue
                }
                onChange={(value) =>
                  handleConfigChange(field.key, value)
                }
              />
            ))}
          </div>
        )}

        {currentTab === 'media' && (
          <NodeMediaUploadSection
            nodeType={selectedNode.data.nodeType}
            nodeId={selectedNode.id}
          />
        )}
      </div>

      {/* Node ID footer */}
      <div className="border-t border-gray-200 px-4 py-2 dark:border-gray-700">
        <p className="truncate text-[10px] text-gray-400">
          ID: {selectedNode.id}
        </p>
      </div>
    </div>
  );
});

/* ---------- General Tab ---------- */

function GeneralTab({
  description,
  nodeLabel,
  onLabelChange,
}: {
  description: string;
  nodeLabel: string;
  onLabelChange: (label: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Node Label
        </label>
        <input
          type="text"
          value={nodeLabel}
          onChange={(e) => onLabelChange(e.target.value)}
          className={cn(
            'w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs',
            'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
            'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200',
          )}
        />
      </div>
    </div>
  );
}

/* ---------- Provider Tab ---------- */

function ProviderTab({
  supportedProviders,
  selectedProvider,
  selectedModel,
  modelParams,
  onProviderChange,
  onModelChange,
  onModelParamChange,
}: {
  supportedProviders: string[];
  selectedProvider: string | null;
  selectedModel: string | null;
  modelParams: Record<string, unknown>;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  onModelParamChange: (key: string, value: unknown) => void;
}) {
  const { models } = useProviderModels(selectedProvider);
  const selectedModelInfo = models.find((m) => m.id === selectedModel);

  return (
    <div className="space-y-4">
      <ProviderSelector
        providers={supportedProviders}
        selectedProvider={selectedProvider}
        selectedModel={selectedModel}
        onProviderChange={onProviderChange}
        onModelChange={onModelChange}
      />

      {selectedModelInfo && (selectedModelInfo.parameters ?? []).length > 0 && (
        <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
          <ModelParameterForm
            parameters={selectedModelInfo.parameters!}
            values={modelParams}
            onChange={onModelParamChange}
          />
        </div>
      )}
    </div>
  );
}

/* ---------- Config Field Renderer ---------- */

type ConfigFieldRendererProps = {
  field: ConfigField;
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
};

function ConfigFieldRenderer({
  field,
  value,
  onChange,
}: ConfigFieldRendererProps) {
  switch (field.type) {
    case 'text':
      return (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {field.label}
          </label>
          <input
            type="text"
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={cn(
              'w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs',
              'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
              'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200',
            )}
          />
        </div>
      );

    case 'textarea':
      return (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {field.label}
          </label>
          <textarea
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={4}
            className={cn(
              'w-full resize-y rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs',
              'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
              'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200',
            )}
          />
        </div>
      );

    case 'number':
      return (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {field.label}
          </label>
          <input
            type="number"
            value={Number(value)}
            onChange={(e) => onChange(Number(e.target.value))}
            min={field.min}
            max={field.max}
            step={field.step}
            className={cn(
              'w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs',
              'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
              'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200',
            )}
          />
        </div>
      );

    case 'select':
      return (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {field.label}
          </label>
          <select
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              'w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs',
              'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
              'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200',
            )}
          >
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );

    case 'toggle':
      return (
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {field.label}
          </label>
          <button
            onClick={() => onChange(!value)}
            className={cn(
              'relative h-5 w-9 rounded-full transition-colors',
              value
                ? 'bg-blue-600 dark:bg-blue-500'
                : 'bg-gray-300 dark:bg-gray-600',
            )}
          >
            <span
              className={cn(
                'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                value && 'translate-x-4',
              )}
            />
          </button>
        </div>
      );

    case 'slider':
      return (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {field.label}
            </label>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {value}
            </span>
          </div>
          <input
            type="range"
            value={Number(value)}
            onChange={(e) => onChange(Number(e.target.value))}
            min={field.min}
            max={field.max}
            step={field.step}
            className="w-full accent-blue-600"
          />
        </div>
      );

    default:
      return null;
  }
}

/* ---------- Media Upload Section ---------- */

function NodeMediaUploadSection({
  nodeType,
  nodeId,
}: {
  nodeType: string;
  nodeId: string;
}) {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const uploadConfig = NODE_UPLOAD_CONFIG[nodeType];

  if (!uploadConfig || !activeProjectId) return null;

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
        {uploadConfig.label}
      </label>
      <MediaUploader
        projectId={activeProjectId}
        nodeId={nodeId}
        allowedTypes={uploadConfig.types}
        maxFiles={1}
        compact
      />
    </div>
  );
}
