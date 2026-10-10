// Chat model shared by the agent chat components.

export type StepStatus = 'running' | 'completed' | 'error';

/** One entry of the "Denkprozess" timeline — usually one Claude Code tool call. */
export interface ThinkingStep {
  id: string;
  label: string;
  status: StepStatus;
  /** Claude Code tool name (Read, Edit, Bash, …) — picks the orb animation. */
  tool?: string;
  /** Shown when the step is expanded: command output, diff stat, file path … */
  summary?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  /** Steps of the turn that produced this assistant message (recap after it finished). */
  steps?: ThinkingStep[];
  quickReplies?: string[];
  /** Streaming in progress for this message. */
  streaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  agentId: string;
  updatedAt: string;
  pinned?: boolean;
  /** CLI session behind this conversation — sent back to continue the same session. */
  sessionId?: string;
  /** The project the conversation is about; its CLI session runs in that folder. */
  projectId?: string;
}
