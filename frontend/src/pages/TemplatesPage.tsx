import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TemplateBrowser } from '@/components/templates/TemplateBrowser';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useProjectList } from '@/hooks/useProjects';
import { useTemplateActions } from '@/hooks/useTemplates';
import type { WorkflowTemplate } from '@/types/template.types';
import { ROUTES } from '@/config/routes';

export function Component() {
  const navigate = useNavigate();
  const { data: projectsData } = useProjectList();
  const { useTemplate, isCloning } = useTemplateActions();
  const [pendingTemplate, setPendingTemplate] = useState<WorkflowTemplate | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const projects = projectsData?.data ?? [];
  const projectOptions = projects.map((p) => ({ value: p._id, label: p.name }));

  const handleUseTemplate = (template: WorkflowTemplate) => {
    if (projects.length === 0) {
      navigate(ROUTES.DASHBOARD);
      return;
    }
    if (projects.length === 1) {
      useTemplate(template._id, projects[0]._id);
      return;
    }
    setPendingTemplate(template);
    setSelectedProjectId(projects[0]?._id ?? '');
  };

  const handleConfirmUse = () => {
    if (!pendingTemplate || !selectedProjectId) return;
    useTemplate(pendingTemplate._id, selectedProjectId);
    setPendingTemplate(null);
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Templates
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Browse and use workflow templates to quickly get started.
        </p>
      </div>

      <TemplateBrowser onUseTemplate={handleUseTemplate} />

      {/* Project picker modal when multiple projects exist */}
      <Modal
        isOpen={pendingTemplate !== null}
        onClose={() => setPendingTemplate(null)}
        title="Choose a project"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Select which project to load this template into.
          </p>
          <Select
            label="Project"
            options={projectOptions}
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setPendingTemplate(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmUse}
              isLoading={isCloning}
              disabled={!selectedProjectId}
            >
              Use Template
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
