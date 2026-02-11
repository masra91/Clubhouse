import { useUIStore } from '../stores/uiStore';
import { useAgentStore } from '../stores/agentStore';
import { AgentTerminal } from '../features/agents/AgentTerminal';
import { SleepingClaude } from '../features/agents/SleepingClaude';
import { AgentSettingsView } from '../features/agents/AgentSettingsView';
import { GitLog } from '../features/git/GitLog';
import { FileViewer } from '../features/files/FileViewer';
import { ProjectSettings } from '../features/settings/ProjectSettings';
import { StandaloneTerminal } from '../features/terminal/StandaloneTerminal';

export function MainContentView() {
  const { explorerTab } = useUIStore();
  const { activeAgentId, agents, agentSettingsOpenFor } = useAgentStore();

  if (explorerTab === 'agents') {
    const activeAgent = activeAgentId ? agents[activeAgentId] : null;

    // Show settings view if open for the active durable agent
    if (
      agentSettingsOpenFor &&
      agentSettingsOpenFor === activeAgentId &&
      activeAgent &&
      activeAgent.kind === 'durable' &&
      activeAgent.worktreePath
    ) {
      return <AgentSettingsView agent={activeAgent} />;
    }

    if (!activeAgent) {
      return (
        <div className="flex items-center justify-center h-full bg-ctp-base">
          <div className="text-center text-ctp-subtext0">
            <p className="text-lg mb-2">No active agent</p>
            <p className="text-sm">Add an agent from the sidebar to get started</p>
          </div>
        </div>
      );
    }

    if (activeAgent.status === 'sleeping' || activeAgent.status === 'stopped' || activeAgent.status === 'error') {
      return <SleepingClaude agent={activeAgent} />;
    }

    return (
      <div className="h-full bg-ctp-base">
        <AgentTerminal agentId={activeAgentId!} />
      </div>
    );
  }

  if (explorerTab === 'terminal') {
    return <StandaloneTerminal />;
  }

  if (explorerTab === 'files') {
    return <FileViewer />;
  }

  if (explorerTab === 'git') {
    return <GitLog />;
  }

  if (explorerTab === 'settings') {
    return <ProjectSettings />;
  }

  return (
    <div className="flex items-center justify-center h-full bg-ctp-base">
      <p className="text-ctp-subtext0">
        Select a tab from the explorer
      </p>
    </div>
  );
}
