import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import * as agentSettings from '../services/agent-settings-service';

export function registerAgentSettingsHandlers(): void {
  ipcMain.handle(IPC.AGENT.READ_CLAUDE_MD, (_event, worktreePath: string) => {
    return agentSettings.readClaudeMd(worktreePath);
  });

  ipcMain.handle(IPC.AGENT.SAVE_CLAUDE_MD, (_event, worktreePath: string, content: string) => {
    agentSettings.writeClaudeMd(worktreePath, content);
  });

  ipcMain.handle(IPC.AGENT.READ_MCP_CONFIG, (_event, worktreePath: string) => {
    return agentSettings.readMcpConfig(worktreePath);
  });

  ipcMain.handle(IPC.AGENT.LIST_SKILLS, (_event, worktreePath: string) => {
    return agentSettings.listSkills(worktreePath);
  });
}
