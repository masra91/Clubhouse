import { Agent } from '../../../shared/types';
import { AGENT_COLORS } from '../../../shared/name-generator';

interface Props {
  agent: Agent;
  size?: 'sm' | 'md';
  showRing?: boolean;
  ringColor?: string;
}

export function AgentAvatar({ agent, size = 'md', showRing = false, ringColor }: Props) {
  const colorInfo = AGENT_COLORS.find((c) => c.id === agent.color);
  const bgColor = colorInfo?.hex || '#6366f1';

  const outerSize = size === 'sm' ? 'w-8 h-8' : 'w-9 h-9';
  const innerSize = size === 'sm' ? 'w-6 h-6' : 'w-7 h-7';
  const fontSize = size === 'sm' ? 'text-[9px]' : 'text-[10px]';

  const renderContent = () => {
    if (agent.kind !== 'durable') {
      // Quick agent: lightning bolt
      return (
        <div className={`${innerSize} rounded-full flex items-center justify-center bg-surface-2 text-ctp-subtext0`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
      );
    }

    // Default initials
    const initials = agent.name.split('-').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
    return (
      <div
        className={`${innerSize} rounded-full flex items-center justify-center ${fontSize} font-bold text-white`}
        style={{ backgroundColor: bgColor }}
      >
        {initials}
      </div>
    );
  };

  if (showRing && ringColor) {
    return (
      <div
        className={`${outerSize} rounded-full flex items-center justify-center`}
        style={{ border: `2px solid ${ringColor}` }}
      >
        {renderContent()}
      </div>
    );
  }

  return renderContent();
}
