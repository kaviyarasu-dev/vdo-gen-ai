import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { CreateProjectPayload, ProjectSettings } from '@/types/workflow.types';

type ProjectWizardProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateProjectPayload) => Promise<unknown>;
  isSubmitting: boolean;
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
  { value: '24', label: '24 fps (Film)' },
  { value: '30', label: '30 fps (Standard)' },
  { value: '60', label: '60 fps (Smooth)' },
];

const STEP_COUNT = 2;

export function ProjectWizard({ isOpen, onClose, onSubmit, isSubmitting }: ProjectWizardProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [settings, setSettings] = useState<ProjectSettings>({
    outputResolution: '1920x1080',
    outputFormat: 'mp4',
    frameRate: 30,
  });
  const [nameError, setNameError] = useState('');

  const resetForm = () => {
    setStep(0);
    setName('');
    setDescription('');
    setSettings({ outputResolution: '1920x1080', outputFormat: 'mp4', frameRate: 30 });
    setNameError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleNext = () => {
    if (step === 0) {
      if (!name.trim()) {
        setNameError('Project name is required');
        return;
      }
      setNameError('');
      setStep(1);
      return;
    }

    handleSubmit();
  };

  const handleSubmit = async () => {
    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      settings,
    });
    handleClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New Project" size="lg">
      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2">
        {Array.from({ length: STEP_COUNT }, (_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= step
                ? 'bg-blue-500'
                : 'bg-gray-200 dark:bg-gray-700'
            }`}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <Input
            label="Project Name"
            placeholder="My Awesome Video"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError('');
            }}
            error={nameError}
            autoFocus
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of your video project..."
              rows={3}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:ring-offset-gray-900"
            />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <Select
            label="Output Resolution"
            options={RESOLUTION_OPTIONS}
            value={settings.outputResolution}
            onChange={(e) =>
              setSettings((s) => ({ ...s, outputResolution: e.target.value }))
            }
          />
          <Select
            label="Output Format"
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
      )}

      {/* Actions */}
      <div className="mt-6 flex items-center justify-between">
        <div>
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleNext} isLoading={isSubmitting}>
            {step < STEP_COUNT - 1 ? 'Next' : 'Create Project'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
