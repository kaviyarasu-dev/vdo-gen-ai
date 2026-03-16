import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { Project, UpdateProjectPayload, ProjectSettings as ProjectSettingsType } from '@/types/workflow.types';

type ProjectSettingsProps = {
  project: Project;
  onSave: (id: string, payload: UpdateProjectPayload) => Promise<unknown>;
  isSaving: boolean;
};

const RESOLUTION_OPTIONS = [
  { value: '1920x1080', label: '1080p (1920x1080)' },
  { value: '1280x720', label: '720p (1280x720)' },
  { value: '3840x2160', label: '4K (3840x2160)' },
  { value: '1080x1920', label: 'Vertical 1080p (1080x1920)' },
  { value: '1080x1080', label: 'Square (1080x1080)' },
];

const FORMAT_OPTIONS = [
  { value: 'mp4', label: 'MP4' },
  { value: 'webm', label: 'WebM' },
  { value: 'mov', label: 'MOV' },
];

const FRAME_RATE_OPTIONS = [
  { value: '24', label: '24 fps' },
  { value: '30', label: '30 fps' },
  { value: '60', label: '60 fps' },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

export function ProjectSettingsForm({ project, onSave, isSaving }: ProjectSettingsProps) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [status, setStatus] = useState(project.status);
  const [settings, setSettings] = useState<ProjectSettingsType>(project.settings);

  useEffect(() => {
    setName(project.name);
    setDescription(project.description ?? '');
    setStatus(project.status);
    setSettings(project.settings);
  }, [project]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(project._id, {
      name: name.trim(),
      description: description.trim() || undefined,
      status,
      settings,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">General</h3>
        <Input
          label="Project Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-offset-gray-900"
          />
        </div>
        <Select
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(e) => setStatus(e.target.value as Project['status'])}
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Output Settings</h3>
        <Select
          label="Resolution"
          options={RESOLUTION_OPTIONS}
          value={settings.outputResolution}
          onChange={(e) =>
            setSettings((s) => ({ ...s, outputResolution: e.target.value }))
          }
        />
        <Select
          label="Format"
          options={FORMAT_OPTIONS}
          value={settings.outputFormat}
          onChange={(e) =>
            setSettings((s) => ({ ...s, outputFormat: e.target.value }))
          }
        />
        <Select
          label="Frame Rate"
          options={FRAME_RATE_OPTIONS}
          value={String(settings.frameRate)}
          onChange={(e) =>
            setSettings((s) => ({ ...s, frameRate: Number(e.target.value) }))
          }
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" isLoading={isSaving}>
          Save Changes
        </Button>
      </div>
    </form>
  );
}
