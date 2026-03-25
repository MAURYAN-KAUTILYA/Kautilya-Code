export type CommandTier = 'standard' | 'elite' | 'sentinel';
export type CommandType = 'temporary' | 'persistent' | 'utility';

export interface CommandConfig {
  name: string;
  slash: string;
  tier: CommandTier;
  type: CommandType;
  category: string;
  costMultiplier?: number;
  chipLabel?: string;
  label?: string;
  help?: string;
  indicator?: string;
  effectiveMedium?: 'ask' | 'plan' | 'build';
  minSection?: 'Simple' | 'Think' | 'Chanakya Intelligence';
}

export interface ParsedSlashCommand {
  token: string;
  name: string;
  recognized: boolean;
}

export interface CommandDirectives {
  intent: string | null;
  modifiers: Record<string, boolean>;
  policies: Record<string, boolean>;
  reviewMode: string;
  voiceMode: string;
  effectiveMedium: 'ask' | 'plan' | 'build';
  effectiveSection: 'Simple' | 'Think' | 'Chanakya Intelligence';
  creditMultiplier: number;
  temporaryCommands: string[];
  persistentCommands: string[];
  parallelAgents: {
    webResearch: boolean;
    designInspiration: boolean;
  };
  summary: string;
}

export interface ResolvedCommandSet {
  commands: CommandConfig[];
  knownNames: string[];
  unknownNames: string[];
  duplicateNames: string[];
  errors: string[];
  warnings: string[];
  notices: string[];
  toggledPersistent: Record<string, boolean>;
  nextPersistent: Record<string, boolean>;
  directives: CommandDirectives;
}

export const COMMAND_TIERS: Record<CommandTier, string>;
export const PERSISTENT_COMMANDS: string[];
export const UTILITY_COMMANDS: string[];
export const DEFAULT_PERSISTENT_COMMANDS: Record<'debug' | 'freeze' | 'nofake', boolean>;
export const COMMAND_REGISTRY: Record<string, CommandConfig>;
export const COMMAND_LIST: CommandConfig[];

export function parseLeadingSlashCommands(text: string): {
  tokens: ParsedSlashCommand[];
  body: string;
};

export function resolveCommandSet(input?: {
  commandNames?: string[];
  persistentCommands?: Record<string, boolean>;
  variant?: string;
  section?: string;
  medium?: string;
}): ResolvedCommandSet;

export function describePersistentCommands(persistentCommands?: Record<string, boolean>): CommandConfig[];
export function buildCommandReference(): Record<string, CommandConfig[]>;
