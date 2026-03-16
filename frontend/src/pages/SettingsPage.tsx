import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Key,
  CheckCircle,
  XCircle,
  Minus,
  Eye,
  EyeOff,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import {
  providerListQuery,
  defaultProvidersQuery,
} from '@/api/queries/providerQueries';
import {
  useSaveApiKey,
  useValidateApiKey,
  useSaveDefaultProviders,
} from '@/api/mutations/providerMutations';
import {
  PROVIDER_DISPLAY_NAMES,
  type AIProvider,
  type ProviderCategory,
  type ProviderApiKeyStatus,
  type DefaultProviderPreferences,
} from '@/types/provider.types';

type SettingsSection = 'api-keys' | 'defaults';

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: 'api-keys', label: 'API Keys' },
  { id: 'defaults', label: 'Default Providers' },
];

export function Component() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('api-keys');

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Settings
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Manage your API keys and default provider preferences.
        </p>
      </div>

      {/* Section tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={cn(
              'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              activeSection === section.id
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200',
            )}
          >
            {section.label}
          </button>
        ))}
      </div>

      {activeSection === 'api-keys' && <ApiKeysSection />}
      {activeSection === 'defaults' && <DefaultProvidersSection />}
    </div>
  );
}

/* ---------- API Keys Section ---------- */

function ApiKeysSection() {
  const { data: providers = [], isLoading } = useQuery(providerListQuery());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const grouped = groupProvidersByCategory(providers);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          API keys are encrypted and stored securely. Only the last 4 characters are displayed.
        </p>
      </div>

      {CATEGORY_ORDER.map((category) => {
        const categoryProviders = grouped[category];
        if (!categoryProviders || categoryProviders.length === 0) return null;

        return (
          <div key={category}>
            <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
              {CATEGORY_LABELS[category]}
            </h3>
            <div className="space-y-3">
              {categoryProviders.map((provider) => (
                <ApiKeyRow key={provider.slug} provider={provider} />
              ))}
            </div>
          </div>
        );
      })}

      {providers.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
          No providers available.
        </p>
      )}
    </div>
  );
}

function ApiKeyRow({ provider }: { provider: AIProvider }) {
  const { addToast } = useToast();
  const [apiKey, setApiKey] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [keyStatus, setKeyStatus] = useState<ProviderApiKeyStatus>(
    provider.isConfigured ? 'valid' : 'not_set',
  );

  const saveKey = useSaveApiKey();
  const validateKey = useValidateApiKey();

  const handleSave = useCallback(() => {
    if (!apiKey.trim()) return;
    saveKey.mutate(
      { provider: provider.slug, apiKey },
      {
        onSuccess: (result) => {
          setKeyStatus(result.status);
          setApiKey('');
          addToast(`API key saved for ${provider.displayName}`, 'success');
        },
        onError: () => {
          addToast(`Failed to save API key for ${provider.displayName}`, 'error');
        },
      },
    );
  }, [apiKey, provider, saveKey, addToast]);

  const handleValidate = useCallback(() => {
    if (!apiKey.trim() && !provider.isConfigured) return;
    validateKey.mutate(
      { provider: provider.slug, apiKey: apiKey || '' },
      {
        onSuccess: (result) => {
          setKeyStatus(result.status);
          if (result.status === 'valid') {
            addToast(`API key for ${provider.displayName} is valid`, 'success');
          } else {
            addToast(`API key for ${provider.displayName} is invalid`, 'error');
          }
        },
        onError: () => {
          addToast('Validation failed', 'error');
        },
      },
    );
  }, [apiKey, provider, validateKey, addToast]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {PROVIDER_DISPLAY_NAMES[provider.slug] ?? provider.displayName}
          </span>
          <StatusBadge status={keyStatus} />
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <div className="relative flex-1">
          <input
            type={isVisible ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              provider.isConfigured
                ? 'Enter new key to replace...'
                : 'Enter your API key...'
            }
            className={cn(
              'h-9 w-full rounded-md border border-gray-300 bg-white px-3 pr-9 text-sm',
              'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
              'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200',
            )}
          />
          <button
            onClick={() => setIsVisible(!isVisible)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleValidate}
          isLoading={validateKey.isPending}
          disabled={!apiKey.trim() && !provider.isConfigured}
        >
          Validate
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          isLoading={saveKey.isPending}
          disabled={!apiKey.trim()}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ProviderApiKeyStatus }) {
  switch (status) {
    case 'valid':
      return (
        <Badge variant="success">
          <CheckCircle className="mr-1 h-3 w-3" />
          Valid
        </Badge>
      );
    case 'invalid':
      return (
        <Badge variant="danger">
          <XCircle className="mr-1 h-3 w-3" />
          Invalid
        </Badge>
      );
    case 'not_set':
      return (
        <Badge variant="default">
          <Minus className="mr-1 h-3 w-3" />
          Not Set
        </Badge>
      );
  }
}

/* ---------- Default Providers Section ---------- */

function DefaultProvidersSection() {
  const { data: providers = [], isLoading: isLoadingProviders } = useQuery(providerListQuery());
  const { data: defaults, isLoading: isLoadingDefaults } = useQuery(defaultProvidersQuery());
  const saveDefaults = useSaveDefaultProviders();
  const { addToast } = useToast();

  const [preferences, setPreferences] = useState<DefaultProviderPreferences | null>(null);

  // Initialize from server data
  const currentPrefs: DefaultProviderPreferences = preferences ?? defaults ?? {
    'text-analysis': { provider: null, model: null },
    'image-generation': { provider: null, model: null },
    'video-generation': { provider: null, model: null },
  };

  const handleProviderChange = (category: ProviderCategory, provider: string) => {
    setPreferences({
      ...currentPrefs,
      [category]: { provider: provider || null, model: null },
    });
  };

  const handleModelChange = (category: ProviderCategory, model: string) => {
    setPreferences({
      ...currentPrefs,
      [category]: { ...currentPrefs[category], model: model || null },
    });
  };

  const handleSave = () => {
    saveDefaults.mutate(currentPrefs, {
      onSuccess: () => {
        addToast('Default providers saved', 'success');
        setPreferences(null);
      },
      onError: () => {
        addToast('Failed to save default providers', 'error');
      },
    });
  };

  if (isLoadingProviders || isLoadingDefaults) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const grouped = groupProvidersByCategory(providers);

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Set default provider and model for each category. These will be used when adding new nodes to the canvas.
      </p>

      {CATEGORY_ORDER.map((category) => {
        const categoryProviders = grouped[category] ?? [];
        const pref = currentPrefs[category];

        return (
          <div
            key={category}
            className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
          >
            <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
              {CATEGORY_LABELS[category]}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Provider
                </label>
                <select
                  value={pref.provider ?? ''}
                  onChange={(e) => handleProviderChange(category, e.target.value)}
                  className={cn(
                    'h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm',
                    'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
                    'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200',
                  )}
                >
                  <option value="">None</option>
                  {categoryProviders.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {PROVIDER_DISPLAY_NAMES[p.slug] ?? p.displayName}
                      {p.isConfigured ? '' : ' (not configured)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Model
                </label>
                <DefaultModelSelector
                  category={category}
                  providerSlug={pref.provider}
                  selectedModel={pref.model}
                  onModelChange={(model) => handleModelChange(category, model)}
                  providers={categoryProviders}
                />
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          isLoading={saveDefaults.isPending}
          disabled={!preferences}
        >
          Save Defaults
        </Button>
      </div>
    </div>
  );
}

function DefaultModelSelector({
  providerSlug,
  selectedModel,
  onModelChange,
  providers,
}: {
  category: ProviderCategory;
  providerSlug: string | null;
  selectedModel: string | null;
  onModelChange: (model: string) => void;
  providers: AIProvider[];
}) {
  const provider = providers.find((p) => p.slug === providerSlug);
  const models = provider?.models ?? [];

  return (
    <select
      value={selectedModel ?? ''}
      onChange={(e) => onModelChange(e.target.value)}
      disabled={!providerSlug || models.length === 0}
      className={cn(
        'h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm',
        'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
        'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      <option value="">
        {!providerSlug ? 'Select a provider first' : 'Select a model...'}
      </option>
      {models.map((model) => (
        <option key={model.id} value={model.id}>
          {model.name}
        </option>
      ))}
    </select>
  );
}

/* ---------- Helpers ---------- */

const CATEGORY_ORDER: ProviderCategory[] = [
  'text-analysis',
  'image-generation',
  'video-generation',
];

const CATEGORY_LABELS: Record<ProviderCategory, string> = {
  'text-analysis': 'Text Analysis',
  'image-generation': 'Image Generation',
  'video-generation': 'Video Generation',
};

function groupProvidersByCategory(
  providers: AIProvider[],
): Record<ProviderCategory, AIProvider[]> {
  const grouped: Record<ProviderCategory, AIProvider[]> = {
    'text-analysis': [],
    'image-generation': [],
    'video-generation': [],
  };

  for (const provider of providers) {
    if (grouped[provider.category]) {
      grouped[provider.category].push(provider);
    }
  }

  return grouped;
}
