import { useMemo, useCallback } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useAgentStore } from '../../stores/agentStore';
import { useUIStore } from '../../stores/uiStore';
import { Project, Agent } from '../../../shared/types';
import { AGENT_COLORS } from '../../../shared/name-generator';

const STATUS_CONFIG: Record<string, { label: string; dotClass: string }> = {
  running: { label: 'Running', dotClass: 'bg-green-400' },
  sleeping: { label: 'Sleeping', dotClass: 'bg-yellow-400' },
  stopped: { label: 'Stopped', dotClass: 'bg-ctp-subtext0' },
  error: { label: 'Error', dotClass: 'bg-red-400' },
};

const DETAILED_DOT: Record<string, string> = {
  idle: 'bg-green-400',
  working: 'bg-blue-400',
  needs_permission: 'bg-orange-400',
  tool_error: 'bg-red-400',
};

function useNavigateToAgent() {
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent);
  const setExplorerTab = useUIStore((s) => s.setExplorerTab);

  return useCallback(
    (projectId: string, agentId: string) => {
      setActiveProject(projectId);
      setActiveAgent(agentId);
      setExplorerTab('agents');
    },
    [setActiveProject, setActiveAgent, setExplorerTab]
  );
}

function AgentAvatar({ agent, size = 'sm' }: { agent: Agent; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs';
  if (agent.kind === 'durable') {
    const colorInfo = AGENT_COLORS.find((c) => c.id === agent.color);
    return (
      <div
        className={`${dim} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0`}
        style={{ backgroundColor: colorInfo?.hex || '#6366f1' }}
      >
        {agent.name.split('-').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
      </div>
    );
  }
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center flex-shrink-0 bg-surface-2 text-ctp-subtext0`}
    >
      <svg width={size === 'sm' ? 10 : 14} height={size === 'sm' ? 10 : 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    </div>
  );
}

/* ─── Global Summary Bar ─── */

function SummaryBar() {
  const agents = useAgentStore((s) => s.agents);
  const detailedStatus = useAgentStore((s) => s.agentDetailedStatus);

  const counts = useMemo(() => {
    const all = Object.values(agents);
    let working = 0, idle = 0, sleeping = 0, stopped = 0, errored = 0;
    for (const a of all) {
      if (a.status === 'running') {
        const d = detailedStatus[a.id];
        if (d && d.state === 'working') working++;
        else idle++;
      } else if (a.status === 'sleeping') {
        sleeping++;
      } else if (a.status === 'error') {
        errored++;
      } else {
        stopped++;
      }
    }
    return { working, idle, sleeping, stopped, errored, total: all.length };
  }, [agents, detailedStatus]);

  if (counts.total === 0) return null;

  const pills: { label: string; count: number; dot: string; pulse?: boolean }[] = [
    { label: 'Working', count: counts.working, dot: 'bg-blue-400', pulse: true },
    { label: 'Idle', count: counts.idle, dot: 'bg-green-400' },
    { label: 'Sleeping', count: counts.sleeping, dot: 'bg-yellow-400' },
    { label: 'Stopped', count: counts.stopped, dot: 'bg-ctp-subtext0' },
    { label: 'Error', count: counts.errored, dot: 'bg-red-400' },
  ];

  return (
    <div className="flex items-center gap-3 flex-wrap mb-5">
      {pills.map(
        (p) =>
          p.count > 0 && (
            <span
              key={p.label}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-0 text-xs text-ctp-subtext1"
            >
              <span className={`w-2 h-2 rounded-full ${p.dot} ${p.pulse ? 'animate-pulse' : ''}`} />
              {p.count} {p.label}
            </span>
          )
      )}
    </div>
  );
}

/* ─── Needs Attention Box ─── */

function NeedsAttentionBox() {
  const agents = useAgentStore((s) => s.agents);
  const detailedStatus = useAgentStore((s) => s.agentDetailedStatus);
  const projects = useProjectStore((s) => s.projects);
  const navigateToAgent = useNavigateToAgent();

  const attentionAgents = useMemo(() => {
    const result: { agent: Agent; reason: string; projectName: string }[] = [];
    for (const agent of Object.values(agents)) {
      const d = detailedStatus[agent.id];
      let reason: string | null = null;
      if (d?.state === 'needs_permission') reason = 'Needs permission';
      else if (d?.state === 'tool_error') reason = 'Tool failed';
      else if (agent.status === 'error') reason = 'Error';
      if (reason) {
        const proj = projects.find((p) => p.id === agent.projectId);
        result.push({ agent, reason, projectName: proj?.name || 'Unknown' });
      }
    }
    return result;
  }, [agents, detailedStatus, projects]);

  if (attentionAgents.length === 0) return null;

  return (
    <div className="border border-orange-400/40 bg-orange-400/5 rounded-xl p-4 mb-5">
      <h2 className="text-sm font-semibold text-orange-300 mb-2">Needs Attention</h2>
      <div className="flex flex-col gap-1">
        {attentionAgents.map(({ agent, reason, projectName }) => (
          <button
            key={agent.id}
            onClick={() => navigateToAgent(agent.projectId, agent.id)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-orange-400/10 transition-colors cursor-pointer text-left w-full"
          >
            <AgentAvatar agent={agent} size="sm" />
            <span className="text-sm text-ctp-text font-medium truncate">{agent.name}</span>
            <span className="text-xs text-ctp-subtext0 truncate">{projectName}</span>
            <span className="ml-auto text-xs text-orange-400 flex-shrink-0">{reason}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Agent Row inside Project Card ─── */

function AgentRow({ agent, navigateToAgent }: { agent: Agent; navigateToAgent: (projectId: string, agentId: string) => void }) {
  const detailedStatus = useAgentStore((s) => s.agentDetailedStatus);
  const detailed = detailedStatus[agent.id];

  const statusInfo = STATUS_CONFIG[agent.status] || STATUS_CONFIG.stopped;
  const hasDetailed = agent.status === 'running' && detailed;
  const dotClass = hasDetailed ? DETAILED_DOT[detailed.state] || 'bg-green-400' : statusInfo.dotClass;
  const shouldPulse = hasDetailed ? detailed.state === 'working' : false;
  const statusLabel = hasDetailed ? detailed.message : statusInfo.label;

  return (
    <button
      onClick={() => navigateToAgent(agent.projectId, agent.id)}
      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-1/60 transition-colors cursor-pointer text-left w-full"
    >
      <AgentAvatar agent={agent} size="md" />

      <span className="text-sm text-ctp-text font-medium truncate min-w-0">{agent.name}</span>

      {/* Status */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass} ${shouldPulse ? 'animate-pulse' : ''}`} />
        <span
          className={`text-xs truncate ${
            hasDetailed && detailed.state === 'needs_permission'
              ? 'text-orange-400'
              : hasDetailed && detailed.state === 'tool_error'
                ? 'text-red-400'
                : 'text-ctp-subtext0'
          }`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Branch */}
      {agent.branch && (
        <span className="text-xs text-ctp-subtext0 truncate flex-shrink-0 ml-auto max-w-[140px]" title={agent.branch}>
          <svg className="inline w-3 h-3 mr-0.5 -mt-px" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="6" y1="3" x2="6" y2="15" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 9a9 9 0 0 1-9 9" />
          </svg>
          {agent.branch}
        </span>
      )}
    </button>
  );
}

/* ─── Project Card ─── */

function ProjectCard({ project }: { project: Project }) {
  const allAgents = useAgentStore((s) => s.agents);
  const navigateToAgent = useNavigateToAgent();
  const setActiveProject = useProjectStore((s) => s.setActiveProject);

  const agents = useMemo(
    () => Object.values(allAgents).filter((a) => a.projectId === project.id),
    [allAgents, project.id]
  );

  const durableAgents = agents.filter((a) => a.kind === 'durable');
  const quickAgents = agents.filter((a) => a.kind === 'quick');

  return (
    <div className="bg-ctp-mantle border border-surface-0 rounded-xl overflow-hidden">
      {/* Card Header */}
      <button
        onClick={() => setActiveProject(project.id)}
        className="flex items-center gap-3 px-5 py-4 w-full text-left hover:bg-surface-0/30 transition-colors cursor-pointer"
      >
        <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-lg font-bold flex-shrink-0">
          {project.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-ctp-text truncate">{project.name}</h3>
          <p className="text-xs text-ctp-subtext0 truncate mt-0.5">{project.path}</p>
        </div>
        <span className="text-xs text-ctp-subtext0 flex-shrink-0">
          {agents.length} agent{agents.length !== 1 ? 's' : ''}
        </span>
      </button>

      {/* Agent Rows */}
      {agents.length > 0 && (
        <div className="border-t border-surface-0 px-2 py-1.5">
          {durableAgents.map((a) => (
            <AgentRow key={a.id} agent={a} navigateToAgent={navigateToAgent} />
          ))}
          {quickAgents.length > 0 && durableAgents.length > 0 && quickAgents.length <= 3 && (
            quickAgents.map((a) => (
              <AgentRow key={a.id} agent={a} navigateToAgent={navigateToAgent} />
            ))
          )}
          {quickAgents.length > 0 && (durableAgents.length === 0 || quickAgents.length > 3) && (
            <div className="px-3 py-2 text-xs text-ctp-subtext0">
              {quickAgents.length} quick session{quickAgents.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {agents.length === 0 && (
        <div className="border-t border-surface-0 px-5 py-3">
          <span className="text-xs text-ctp-subtext0">No agents configured</span>
        </div>
      )}
    </div>
  );
}

/* ─── Dashboard ─── */

export function Dashboard() {
  const { projects, pickAndAddProject } = useProjectStore();

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-ctp-text mb-1">Home</h1>
        <p className="text-sm text-ctp-subtext0 mb-6">
          {projects.length} project{projects.length !== 1 ? 's' : ''}
        </p>

        <SummaryBar />
        <NeedsAttentionBox />

        <div className="flex flex-col gap-4">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}

          {/* Add project card */}
          <button
            onClick={() => pickAndAddProject()}
            className="border border-dashed border-surface-2 rounded-xl p-5
              flex flex-col items-center justify-center gap-2 min-h-[100px]
              text-ctp-subtext0 hover:text-ctp-subtext1 hover:border-ctp-subtext0
              transition-all duration-150 cursor-pointer"
          >
            <span className="text-2xl">+</span>
            <span className="text-sm">Add Project</span>
          </button>
        </div>
      </div>
    </div>
  );
}
