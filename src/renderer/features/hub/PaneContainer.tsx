import { useCallback, useRef } from 'react';
import { PaneNode } from '../../stores/hubStore';
import { HubPane } from './HubPane';
import { ResizeHandle } from '../../components/ResizeHandle';
import { useLayoutStore, HUB_PANE_MIN_PX } from '../../stores/layoutStore';

interface Props {
  node: PaneNode;
  onCloseConfirm: (paneId: string, agentId: string) => void;
}

export function PaneContainer({ node, onCloseConfirm }: Props) {
  if (node.type === 'leaf') {
    return <HubPane paneId={node.id} agentId={node.agentId} onCloseConfirm={onCloseConfirm} />;
  }

  return <SplitContainer node={node} onCloseConfirm={onCloseConfirm} />;
}

function SplitContainer({ node, onCloseConfirm }: { node: PaneNode & { type: 'split' }; onCloseConfirm: Props['onCloseConfirm'] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isHorizontal = node.direction === 'horizontal';

  const ratio = useLayoutStore((s) => s.hubSplitRatios[node.id] ?? 0.5);
  const setHubSplitRatio = useLayoutStore((s) => s.setHubSplitRatio);

  const handleResize = useCallback(
    (delta: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const totalDimension = isHorizontal ? rect.width : rect.height;
      if (totalDimension <= 0) return;

      const ratioDelta = delta / totalDimension;
      const minRatio = HUB_PANE_MIN_PX / totalDimension;
      const maxRatio = 1 - minRatio;
      const newRatio = Math.min(maxRatio, Math.max(minRatio, ratio + ratioDelta));
      setHubSplitRatio(node.id, newRatio);
    },
    [isHorizontal, ratio, node.id, setHubSplitRatio],
  );

  const firstStyle = isHorizontal
    ? { width: `${ratio * 100}%`, flexShrink: 0, flexGrow: 0 }
    : { height: `${ratio * 100}%`, flexShrink: 0, flexGrow: 0 };

  return (
    <div
      ref={containerRef}
      className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} h-full w-full overflow-hidden`}
    >
      <div className="min-w-0 min-h-0 overflow-hidden" style={firstStyle}>
        <PaneContainer node={node.children[0]} onCloseConfirm={onCloseConfirm} />
      </div>
      <ResizeHandle direction={isHorizontal ? 'horizontal' : 'vertical'} onResize={handleResize} />
      <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
        <PaneContainer node={node.children[1]} onCloseConfirm={onCloseConfirm} />
      </div>
    </div>
  );
}
