import { useEffect, useMemo } from 'react';
import { useCrossHubStore } from '../../stores/crossHubStore';
import { useAgentStore } from '../../stores/agentStore';
import { CrossPaneContainer } from './CrossPaneContainer';
import { DeleteAgentDialog } from '../agents/DeleteAgentDialog';

export function CrossHubCommandCenter() {
  const paneTree = useCrossHubStore((s) => s.paneTree);
  const loadCrossHub = useCrossHubStore((s) => s.loadCrossHub);
  const agents = useAgentStore((s) => s.agents);

  const knownAgentIds = useMemo(() => new Set(Object.keys(agents)), [agents]);

  useEffect(() => {
    loadCrossHub(knownAgentIds);
  }, [loadCrossHub, knownAgentIds]);

  if (!paneTree) {
    return (
      <div className="h-full w-full bg-ctp-base flex items-center justify-center">
        <span className="text-ctp-subtext0 text-sm">Loading...</span>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-ctp-base overflow-hidden">
      <CrossPaneContainer node={paneTree} />
      <DeleteAgentDialog />
    </div>
  );
}
