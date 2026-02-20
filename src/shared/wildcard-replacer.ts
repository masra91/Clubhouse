export interface WildcardContext {
  agentName: string;       // e.g. "bold-falcon"
  standbyBranch: string;   // e.g. "bold-falcon/standby"
  agentPath: string;       // e.g. ".clubhouse/agents/bold-falcon/"
}

/**
 * Replace @@AgentName, @@StandbyBranch, and @@Path wildcards in a string.
 * Returns the input unchanged if no wildcards are found.
 */
export function replaceWildcards(text: string, ctx: WildcardContext): string {
  return text
    .replace(/@@AgentName/g, ctx.agentName)
    .replace(/@@StandbyBranch/g, ctx.standbyBranch)
    .replace(/@@Path/g, ctx.agentPath);
}
