import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { EditorLayout } from '@/components/layout/EditorLayout';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useLoadProjectWorkflow } from '@/hooks/useLoadProjectWorkflow';
import { useSocket } from '@/hooks/useSocket';
import { useProjectStore } from '@/stores/useProjectStore';

export function Component() {
  const { projectId } = useParams<{ projectId: string }>();
  const setActiveProjectId = useProjectStore((s) => s.setActiveProjectId);
  const { isLoading } = useLoadProjectWorkflow(projectId);
  const { saveStatus, saveNow } = useAutoSave(projectId);

  // Initialize WebSocket connection for real-time execution updates
  useSocket();

  useEffect(() => {
    setActiveProjectId(projectId ?? null);
    return () => setActiveProjectId(null);
  }, [projectId, setActiveProjectId]);

  // Ctrl/Cmd+S handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveNow();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [saveNow]);

  if (isLoading) {
    return (
      <div className="absolute inset-0">
        <LoadingOverlay label="Loading workflow..." />
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <EditorLayout saveStatus={saveStatus} />
    </div>
  );
}
