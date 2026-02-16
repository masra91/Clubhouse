import { useState, useEffect } from 'react';
import { useProjectStore } from '../stores/projectStore';

const LOADING_OPTIONS = [{ id: 'default', label: 'Default' }];

/**
 * Fetches model options from the orchestrator provider for the active project.
 * Resets to a minimal placeholder immediately on orchestrator change so stale
 * options from the previous provider are never shown.
 */
export function useModelOptions(orchestrator?: string): Array<{ id: string; label: string }> {
  const [options, setOptions] = useState(LOADING_OPTIONS);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const projects = useProjectStore((s) => s.projects);
  const activeProject = projects.find((p) => p.id === activeProjectId);

  useEffect(() => {
    // Immediately clear stale options from previous provider
    setOptions(LOADING_OPTIONS);

    if (!activeProject?.path) return;

    let cancelled = false;
    window.clubhouse.agent.getModelOptions(activeProject.path, orchestrator)
      .then((result) => {
        if (!cancelled && Array.isArray(result) && result.length > 0) {
          setOptions(result);
        }
      })
      .catch(() => {
        // Keep loading placeholder on error
      });

    return () => { cancelled = true; };
  }, [activeProject?.path, orchestrator]);

  return options;
}
