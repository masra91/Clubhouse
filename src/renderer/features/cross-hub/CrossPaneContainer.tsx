import { CrossPaneNode } from '../../stores/crossHubStore';
import { CrossHubPane } from './CrossHubPane';

interface Props {
  node: CrossPaneNode;
}

export function CrossPaneContainer({ node }: Props) {
  if (node.type === 'leaf') {
    return <CrossHubPane paneId={node.id} agentId={node.agentId} projectId={node.projectId} />;
  }

  const isHorizontal = node.direction === 'horizontal';

  return (
    <div className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} h-full w-full overflow-hidden`}>
      <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
        <CrossPaneContainer node={node.children[0]} />
      </div>
      <div className={`flex-shrink-0 ${isHorizontal ? 'w-px' : 'h-px'} bg-surface-0`} />
      <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
        <CrossPaneContainer node={node.children[1]} />
      </div>
    </div>
  );
}
