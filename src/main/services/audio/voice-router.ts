import { Agent } from '../../../shared/types';

export interface RouteResult {
  agentId: string;
  text: string;
  confidence: number;
}

const NAME_PREFIXES = /^(?:hey|ok|yo|hi)?\s*/i;

export class VoiceRouter {
  async route(
    transcription: string,
    agents: Agent[],
    focusedAgentId: string | null,
  ): Promise<RouteResult> {
    if (agents.length === 0) {
      throw new Error('No agents available for routing');
    }

    // Strategy 1: Name match
    const cleaned = transcription.replace(NAME_PREFIXES, '');
    for (const agent of agents) {
      const namePattern = new RegExp(`^${escapeRegex(agent.name)}[,\\s]+`, 'i');
      if (namePattern.test(cleaned)) {
        const text = cleaned.replace(namePattern, '').trim();
        return { agentId: agent.id, text: text || transcription, confidence: 0.95 };
      }
    }

    // Strategy 2: Context match
    if (agents.some((a) => a.mission)) {
      const words = new Set(transcription.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
      let bestAgent = agents[0];
      let bestScore = 0;
      for (const agent of agents) {
        if (!agent.mission) continue;
        const missionWords = agent.mission.toLowerCase().split(/\s+/);
        const overlap = missionWords.filter((w) => words.has(w)).length;
        if (overlap > bestScore) {
          bestScore = overlap;
          bestAgent = agent;
        }
      }
      if (bestScore >= 2) {
        return { agentId: bestAgent.id, text: transcription, confidence: 0.6 + Math.min(bestScore * 0.1, 0.3) };
      }
    }

    // Strategy 3: Focused agent fallback
    if (focusedAgentId && agents.some((a) => a.id === focusedAgentId)) {
      return { agentId: focusedAgentId, text: transcription, confidence: 0.5 };
    }

    // Final fallback: first agent
    return { agentId: agents[0].id, text: transcription, confidence: 0.3 };
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
