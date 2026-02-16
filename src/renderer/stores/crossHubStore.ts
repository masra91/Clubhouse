import { create } from 'zustand';

export type CrossPaneNode =
  | { id: string; type: 'leaf'; agentId: string | null; projectId: string | null }
  | { id: string; type: 'split'; direction: 'horizontal' | 'vertical'; children: [CrossPaneNode, CrossPaneNode] };

let paneCounter = 0;
function generatePaneId(): string {
  return `cross_pane_${paneCounter++}`;
}

const STORAGE_KEY = 'cross_hub_layout';

function saveToStorage(tree: CrossPaneNode | null): void {
  if (!tree) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
  } catch {
    // Ignore quota errors
  }
}

function loadFromStorage(): CrossPaneNode | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CrossPaneNode;
  } catch {
    return null;
  }
}

/** Null out agentIds that aren't in the known set, so those panes revert to the picker. */
function validateAgents(node: CrossPaneNode, knownAgentIds: Set<string>): CrossPaneNode {
  if (node.type === 'leaf') {
    if (node.agentId && !knownAgentIds.has(node.agentId)) {
      return { ...node, agentId: null, projectId: null };
    }
    return node;
  }
  return {
    ...node,
    children: [
      validateAgents(node.children[0], knownAgentIds),
      validateAgents(node.children[1], knownAgentIds),
    ],
  };
}

/** Find the max pane counter in a tree so new IDs don't collide with restored ones. */
function maxPaneCounter(node: CrossPaneNode): number {
  const match = node.id.match(/^cross_pane_(\d+)$/);
  const current = match ? parseInt(match[1], 10) : -1;
  if (node.type === 'leaf') return current;
  return Math.max(current, maxPaneCounter(node.children[0]), maxPaneCounter(node.children[1]));
}

function findAndReplace(node: CrossPaneNode, targetId: string, replacement: CrossPaneNode): CrossPaneNode | null {
  if (node.id === targetId) return replacement;
  if (node.type === 'split') {
    const left = findAndReplace(node.children[0], targetId, replacement);
    if (left) return { ...node, children: [left, node.children[1]] };
    const right = findAndReplace(node.children[1], targetId, replacement);
    if (right) return { ...node, children: [node.children[0], right] };
  }
  return null;
}

function findParentAndSibling(
  node: CrossPaneNode,
  targetId: string,
  parent: CrossPaneNode | null = null,
  siblingIndex: 0 | 1 | null = null,
): { parent: CrossPaneNode; sibling: CrossPaneNode } | null {
  if (node.id === targetId && parent && parent.type === 'split' && siblingIndex !== null) {
    const sibling = parent.children[siblingIndex === 0 ? 1 : 0];
    return { parent, sibling };
  }
  if (node.type === 'split') {
    const left = findParentAndSibling(node.children[0], targetId, node, 0);
    if (left) return left;
    const right = findParentAndSibling(node.children[1], targetId, node, 1);
    if (right) return right;
  }
  return null;
}

function mapLeaves(node: CrossPaneNode, fn: (leaf: CrossPaneNode & { type: 'leaf' }) => CrossPaneNode): CrossPaneNode {
  if (node.type === 'leaf') return fn(node);
  return {
    ...node,
    children: [mapLeaves(node.children[0], fn), mapLeaves(node.children[1], fn)],
  };
}

function findLeaf(node: CrossPaneNode, id: string): (CrossPaneNode & { type: 'leaf' }) | null {
  if (node.type === 'leaf') return node.id === id ? node : null;
  return findLeaf(node.children[0], id) || findLeaf(node.children[1], id);
}

function getFirstLeafId(node: CrossPaneNode): string {
  if (node.type === 'leaf') return node.id;
  return getFirstLeafId(node.children[0]);
}

interface CrossHubState {
  paneTree: CrossPaneNode | null;
  focusedPaneId: string | null;
  dragSourcePaneId: string | null;
  dragOverPaneId: string | null;
  pickerProjectId: Record<string, string>;
  loadCrossHub: (knownAgentIds: Set<string>) => void;
  splitPane: (paneId: string, direction: 'up' | 'down' | 'left' | 'right') => void;
  closePane: (paneId: string) => void;
  assignAgent: (paneId: string, agentId: string, projectId: string) => void;
  setFocusedPane: (paneId: string | null) => void;
  removePanesByAgent: (agentId: string) => void;
  swapPanes: (paneId1: string, paneId2: string) => void;
  setDragSource: (paneId: string | null) => void;
  setDragOver: (paneId: string | null) => void;
  setPickerProject: (paneId: string, projectId: string) => void;
  clearPickerProject: (paneId: string) => void;
}

export const useCrossHubStore = create<CrossHubState>((set, get) => ({
  paneTree: null,
  focusedPaneId: null,
  dragSourcePaneId: null,
  dragOverPaneId: null,
  pickerProjectId: {},

  loadCrossHub: (knownAgentIds) => {
    const current = get();
    // If already loaded, just validate agents
    if (current.paneTree) {
      const validated = validateAgents(current.paneTree, knownAgentIds);
      if (validated !== current.paneTree) {
        set({ paneTree: validated });
        saveToStorage(validated);
      }
      return;
    }

    // Try to restore from localStorage
    const saved = loadFromStorage();
    if (saved) {
      const max = maxPaneCounter(saved);
      if (max >= paneCounter) paneCounter = max + 1;

      const validated = validateAgents(saved, knownAgentIds);
      const focus = getFirstLeafId(validated);
      set({ paneTree: validated, focusedPaneId: focus });
      saveToStorage(validated);
      return;
    }

    // No saved state — create a fresh single pane
    const id = generatePaneId();
    const tree: CrossPaneNode = { id, type: 'leaf', agentId: null, projectId: null };
    set({ paneTree: tree, focusedPaneId: id });
  },

  splitPane: (paneId, direction) => {
    const tree = get().paneTree;
    if (!tree) return;

    const newPaneId = generatePaneId();
    const splitId = generatePaneId();
    const newLeaf: CrossPaneNode = { id: newPaneId, type: 'leaf', agentId: null, projectId: null };

    const isHorizontal = direction === 'left' || direction === 'right';
    const splitDirection: 'horizontal' | 'vertical' = isHorizontal ? 'horizontal' : 'vertical';
    const newFirst = direction === 'left' || direction === 'up';

    const existingLeaf = findLeaf(tree, paneId);
    if (!existingLeaf) return;

    const replacement: CrossPaneNode = {
      id: splitId,
      type: 'split',
      direction: splitDirection,
      children: newFirst
        ? [newLeaf, { ...existingLeaf }]
        : [{ ...existingLeaf }, newLeaf],
    };

    const newTree = findAndReplace(tree, paneId, replacement);
    if (newTree) {
      set({ paneTree: newTree, focusedPaneId: newPaneId });
      saveToStorage(newTree);
    }
  },

  closePane: (paneId) => {
    const tree = get().paneTree;
    if (!tree) return;

    if (tree.type === 'leaf' && tree.id === paneId) {
      const id = generatePaneId();
      const newTree: CrossPaneNode = { id, type: 'leaf', agentId: null, projectId: null };
      set({ paneTree: newTree, focusedPaneId: id });
      saveToStorage(newTree);
      return;
    }

    const result = findParentAndSibling(tree, paneId);
    if (!result) return;

    const { parent, sibling } = result;
    const newTree = findAndReplace(tree, parent.id, sibling);
    if (newTree) {
      const newFocus = getFirstLeafId(sibling);
      set({ paneTree: newTree, focusedPaneId: newFocus });
      saveToStorage(newTree);
    }
  },

  assignAgent: (paneId, agentId, projectId) => {
    const tree = get().paneTree;
    if (!tree) return;
    const newTree = mapLeaves(tree, (leaf) => {
      if (leaf.id === paneId) return { ...leaf, agentId, projectId };
      return leaf;
    });
    // Clear picker state for this pane
    const { [paneId]: _, ...restPicker } = get().pickerProjectId;
    set({ paneTree: newTree, focusedPaneId: paneId, pickerProjectId: restPicker });
    saveToStorage(newTree);
  },

  setFocusedPane: (paneId) => set({ focusedPaneId: paneId }),

  removePanesByAgent: (agentId) => {
    const tree = get().paneTree;
    if (!tree) return;
    const newTree = mapLeaves(tree, (leaf) => {
      if (leaf.agentId === agentId) return { ...leaf, agentId: null, projectId: null };
      return leaf;
    });
    set({ paneTree: newTree });
    saveToStorage(newTree);
  },

  swapPanes: (paneId1, paneId2) => {
    const tree = get().paneTree;
    if (!tree || paneId1 === paneId2) return;
    const leaf1 = findLeaf(tree, paneId1);
    const leaf2 = findLeaf(tree, paneId2);
    if (!leaf1 || !leaf2) return;
    const agent1 = leaf1.agentId;
    const project1 = leaf1.projectId;
    const agent2 = leaf2.agentId;
    const project2 = leaf2.projectId;
    const newTree = mapLeaves(tree, (leaf) => {
      if (leaf.id === paneId1) return { ...leaf, agentId: agent2, projectId: project2 };
      if (leaf.id === paneId2) return { ...leaf, agentId: agent1, projectId: project1 };
      return leaf;
    });
    set({ paneTree: newTree, dragSourcePaneId: null, dragOverPaneId: null });
    saveToStorage(newTree);
  },

  setDragSource: (paneId) => set({ dragSourcePaneId: paneId }),

  setDragOver: (paneId) => set({ dragOverPaneId: paneId }),

  setPickerProject: (paneId, projectId) => {
    set((s) => ({ pickerProjectId: { ...s.pickerProjectId, [paneId]: projectId } }));
  },

  clearPickerProject: (paneId) => {
    set((s) => {
      const { [paneId]: _, ...rest } = s.pickerProjectId;
      return { pickerProjectId: rest };
    });
  },
}));
