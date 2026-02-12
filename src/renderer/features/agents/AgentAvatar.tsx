import { useAgentStore } from '../../stores/agentStore';
import { Agent } from '../../../shared/types';
import { AGENT_COLORS } from '../../../shared/name-generator';

export const STATUS_RING_COLOR: Record<string, string> = {
  running: '#22c55e',
  sleeping: '#6c7086',
  error: '#f87171',
};

export function AgentAvatarWithRing({ agent }: { agent: Agent }) {
  const detailedStatus = useAgentStore((s) => s.agentDetailedStatus);
  const detailed = detailedStatus[agent.id];
  const isWorking = agent.status === 'running' && detailed?.state === 'working';
  const baseRingColor = STATUS_RING_COLOR[agent.status] || STATUS_RING_COLOR.sleeping;
  const ringColor = agent.status === 'running' && detailed?.state === 'needs_permission' ? '#f97316'
    : agent.status === 'running' && detailed?.state === 'tool_error' ? '#facc15'
    : baseRingColor;

  const colorInfo = AGENT_COLORS.find((c) => c.id === agent.color);
  const initials = agent.name.split('-').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className={`relative flex-shrink-0 ${isWorking ? 'animate-pulse-ring' : ''}`}>
      {/* Ring */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center"
        style={{ border: `2px solid ${ringColor}` }}
      >
        {/* Avatar */}
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
          style={{ backgroundColor: colorInfo?.hex || '#6366f1' }}
        >
          {initials}
        </div>
      </div>
    </div>
  );
}
