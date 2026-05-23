import type { RecentConnection } from './types';

export const RECENT_CONNECTIONS_STORAGE_KEY = 'openDevContainer.recentConnections';
export const RECENT_CONNECTION_LIMIT = 10;

export type GlobalStateLike = {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Thenable<void>;
};

export class RecentConnectionStore {
  constructor(private readonly globalState: GlobalStateLike) {}

  async getAll(): Promise<RecentConnection[]> {
    const records = this.globalState.get<unknown>(RECENT_CONNECTIONS_STORAGE_KEY);
    if (!Array.isArray(records)) {
      return [];
    }

    return records
      .map((record) => sanitizeRecentConnection(record))
      .filter((record): record is RecentConnection => Boolean(record))
      .sort((left, right) => right.lastAttachedAt - left.lastAttachedAt);
  }

  async save(record: RecentConnection): Promise<void> {
    const current = await this.getAll();
    const next = [record, ...current.filter((item) => item.connectionKey !== record.connectionKey)].slice(0, RECENT_CONNECTION_LIMIT);
    await this.globalState.update(RECENT_CONNECTIONS_STORAGE_KEY, next);
  }

  async remove(connectionKey: string): Promise<boolean> {
    const current = await this.getAll();
    const next = current.filter((item) => item.connectionKey !== connectionKey);
    if (next.length === current.length) {
      return false;
    }

    await this.globalState.update(RECENT_CONNECTIONS_STORAGE_KEY, next);
    return true;
  }

  async getMostRecent(): Promise<RecentConnection | undefined> {
    const records = await this.getAll();
    return records[0];
  }
}

export function sanitizeRecentConnection(value: unknown): RecentConnection | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const requiredStrings = [
    'connectionKey',
    'containerId',
    'containerName',
    'image',
    'hostAlias',
    'workspaceFolder',
    'dockerPath',
    'remoteUser',
    'sshConfigPath',
    'lastStatus',
    'workingDir',
    'mountSummary'
  ];

  if (!requiredStrings.every((key) => typeof value[key] === 'string')) {
    return undefined;
  }

  if (typeof value.lastAttachedAt !== 'number' || !Number.isFinite(value.lastAttachedAt)) {
    return undefined;
  }

  return value as RecentConnection;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
