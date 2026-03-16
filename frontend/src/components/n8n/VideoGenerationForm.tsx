import { useState, useCallback, type FormEvent } from 'react';
import { Zap, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { useVideoGeneration } from '@/hooks/useVideoGeneration';
import { GenerationResult } from '@/components/n8n/GenerationResult';
import {
  DEFAULT_CONFIG,
  IMAGE_RESOLUTION_OPTIONS,
  VIDEO_MODEL_OPTIONS,
  TRANSITION_TYPE_OPTIONS,
  OUTPUT_RESOLUTION_OPTIONS,
  type VideoGenerationConfig,
  type ImageResolution,
  type VideoModel,
  type TransitionType,
  type OutputResolution,
} from '@/types/n8n.types';
import { env } from '@/config/env';

type FormState = {
  script: string;
  callbackUrl: string;
  config: VideoGenerationConfig;
};

const INITIAL_FORM: FormState = {
  script: '',
  callbackUrl: env.DEFAULT_CALLBACK_URL,
  config: { ...DEFAULT_CONFIG },
};

export function VideoGenerationForm() {
  const { addToast } = useToast();
  const { trigger, generationResult, clearResult, isPending, isError, error } =
    useVideoGeneration();

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const isN8nConfigured = Boolean(env.N8N_URL);

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [],
  );

  const updateConfig = useCallback(
    <K extends keyof VideoGenerationConfig>(key: K, value: VideoGenerationConfig[K]) => {
      setForm((prev) => ({
        ...prev,
        config: { ...prev.config, [key]: value },
      }));
    },
    [],
  );

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.script.trim()) {
      newErrors.script = 'Script is required.';
    } else if (form.script.trim().length < 10) {
      newErrors.script = 'Script must be at least 10 characters.';
    }

    if (!form.callbackUrl.trim()) {
      newErrors.callbackUrl = 'Callback URL is required.';
    } else {
      try {
        new URL(form.callbackUrl);
      } catch {
        newErrors.callbackUrl = 'Must be a valid URL (e.g., https://example.com/callback).';
      }
    }

    setValidationErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    clearResult();
    trigger(
      {
        script: form.script.trim(),
        callback_url: form.callbackUrl.trim(),
        config: form.config,
      },
      {
        onSuccess: () => {
          addToast('Video generation started successfully!', 'success');
        },
        onError: (err) => {
          const message =
            err instanceof Error ? err.message : 'Failed to trigger video generation.';
          addToast(message, 'error');
        },
      },
    );
  };

  const handleReset = () => {
    setForm(INITIAL_FORM);
    setValidationErrors({});
    clearResult();
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            n8n Video Generation
          </h2>
          <Badge variant="purple">Session 6</Badge>
        </div>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Trigger the Master Orchestrator pipeline to generate a video from a script.
        </p>
      </div>

      {/* Warning if N8N_URL not configured */}
      {!isN8nConfigured && (
        <div
          className={cn(
            'mb-6 rounded-lg border-l-4 border-yellow-500 bg-yellow-50 p-4',
            'dark:bg-yellow-900/20 dark:text-yellow-400',
          )}
        >
          <p className="text-sm font-medium">n8n URL not configured</p>
          <p className="mt-1 text-xs">
            Set{' '}
            <code className="rounded bg-yellow-100 px-1 dark:bg-yellow-900/40">VITE_N8N_URL</code>{' '}
            in your <code>.env.local</code> file.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Script input */}
        <Textarea
          label="Script"
          placeholder="Paste your video script here..."
          value={form.script}
          onChange={(e) => updateField('script', e.target.value)}
          error={validationErrors.script}
          rows={8}
        />

        {/* Callback URL */}
        <Input
          label="Callback URL"
          type="url"
          placeholder="https://your-server.com/webhook/video-complete"
          value={form.callbackUrl}
          onChange={(e) => updateField('callbackUrl', e.target.value)}
          error={validationErrors.callbackUrl}
        />

        {/* Config section */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
            Pipeline Configuration
          </h3>

          <div className="space-y-5">
            {/* Parallel Scenes */}
            <Slider
              label="Parallel Scenes"
              min={1}
              max={10}
              step={1}
              value={form.config.parallel_scenes}
              onChange={(e) => updateConfig('parallel_scenes', Number(e.target.value))}
            />

            {/* Grid: 2-column layout for selects */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Image Resolution"
                options={IMAGE_RESOLUTION_OPTIONS}
                value={form.config.image_resolution}
                onChange={(e) =>
                  updateConfig('image_resolution', e.target.value as ImageResolution)
                }
              />
              <Select
                label="Video Model"
                options={VIDEO_MODEL_OPTIONS}
                value={form.config.video_model}
                onChange={(e) => updateConfig('video_model', e.target.value as VideoModel)}
              />
              <Select
                label="Transition Type"
                options={TRANSITION_TYPE_OPTIONS}
                value={form.config.transition_type}
                onChange={(e) =>
                  updateConfig('transition_type', e.target.value as TransitionType)
                }
              />
              <Select
                label="Output Resolution"
                options={OUTPUT_RESOLUTION_OPTIONS}
                value={form.config.output_resolution}
                onChange={(e) =>
                  updateConfig('output_resolution', e.target.value as OutputResolution)
                }
              />
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <Button type="submit" isLoading={isPending} disabled={!isN8nConfigured}>
            <Zap size={16} />
            Generate Video
          </Button>
          <Button type="button" variant="secondary" onClick={handleReset} disabled={isPending}>
            <RotateCcw size={16} />
            Reset
          </Button>
        </div>
      </form>

      {/* Error display */}
      {isError && error && (
        <div
          className={cn(
            'mt-6 rounded-lg border-l-4 border-red-500 bg-red-50 p-4',
            'dark:bg-red-900/20 dark:text-red-400',
          )}
        >
          <p className="text-sm font-medium">Generation Failed</p>
          <p className="mt-1 text-xs">
            {error instanceof Error ? error.message : 'An unexpected error occurred.'}
          </p>
        </div>
      )}

      {/* Success result */}
      {generationResult && <GenerationResult response={generationResult} className="mt-6" />}
    </div>
  );
}
