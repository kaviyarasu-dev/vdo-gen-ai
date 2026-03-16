import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Toggle } from '@/components/ui/Toggle';
import { Button } from '@/components/ui/Button';
import {
  TemplateCategory,
  TEMPLATE_CATEGORY_LABELS,
  type CreateTemplatePayload,
} from '@/types/template.types';
import type { VdoNode } from '@/types/node.types';
import type { VdoEdge } from '@/types/edge.types';

type SaveTemplateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: CreateTemplatePayload) => Promise<unknown>;
  nodes: VdoNode[];
  edges: VdoEdge[];
  isSaving: boolean;
};

const CATEGORY_OPTIONS = Object.entries(TEMPLATE_CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export function SaveTemplateModal({
  isOpen,
  onClose,
  onSave,
  nodes,
  edges,
  isSaving,
}: SaveTemplateModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TemplateCategory>(TemplateCategory.CUSTOM);
  const [tagsInput, setTagsInput] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [nameError, setNameError] = useState('');

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Template name is required');
      return;
    }
    setNameError('');

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    await onSave({
      name: trimmedName,
      description: description.trim() || undefined,
      category,
      nodes,
      edges,
      isPublic,
      tags,
    });

    setName('');
    setDescription('');
    setCategory(TemplateCategory.CUSTOM);
    setTagsInput('');
    setIsPublic(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Save as Template" size="lg">
      <div className="flex flex-col gap-4">
        <Input
          label="Name"
          placeholder="My workflow template"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError('');
          }}
          error={nameError}
        />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="template-description"
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Description
          </label>
          <textarea
            id="template-description"
            rows={3}
            placeholder="Describe what this template does..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:ring-offset-gray-900"
          />
        </div>

        <Select
          label="Category"
          options={CATEGORY_OPTIONS}
          value={category}
          onChange={(e) => setCategory(e.target.value as TemplateCategory)}
        />

        <Input
          label="Tags"
          placeholder="tag1, tag2, tag3"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
        />

        <Toggle
          checked={isPublic}
          onChange={setIsPublic}
          label="Make this template public"
        />

        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            This template will include{' '}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {nodes.length} nodes
            </span>{' '}
            and{' '}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {edges.length} connections
            </span>{' '}
            from your current workflow.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            isLoading={isSaving}
            disabled={!name.trim()}
          >
            Save Template
          </Button>
        </div>
      </div>
    </Modal>
  );
}
