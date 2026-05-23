import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { OpenDevContainerError, formatErrorDetail } from './errors';
import { readFileIfExists, writeFileAtomic } from './fileSystem';
import { escapeRegExp } from './utils';

export const SSH_CONFIG_BEGIN = '# >>> open-dev-container';
export const SSH_CONFIG_END = '# <<< open-dev-container';

export type SshConfigOptions = {
  dockerPath: string;
  containerId: string;
  identityFile: string;
  remoteUser: string;
  sshdPath: string;
  containerSshdConfig: string;
};

export async function upsertSshConfig(sshConfigPath: string, hostAlias: string, options: SshConfigOptions): Promise<void> {
  try {
    await fs.mkdir(path.dirname(sshConfigPath), { recursive: true, mode: 0o700 });
    const current = await readFileIfExists(sshConfigPath);
    const next = upsertManagedHostBlock(current, hostAlias, options);
    await writeFileAtomic(sshConfigPath, next, 0o600);
  } catch (error: unknown) {
    throw new OpenDevContainerError('SSH_CONFIG_WRITE_FAILED', `Failed to update SSH config at ${sshConfigPath}.`, formatErrorDetail(error));
  }
}

export async function removeManagedHostBlockFromFile(sshConfigPath: string, hostAlias: string): Promise<boolean> {
  const current = await readFileIfExists(sshConfigPath);
  const next = removeManagedHostBlock(current, hostAlias);
  if (next === current) {
    return false;
  }

  await writeFileAtomic(sshConfigPath, next, 0o600);
  return true;
}

export async function removeAllManagedBlocksFromFile(sshConfigPath: string): Promise<{ removed: number }> {
  const current = await readFileIfExists(sshConfigPath);
  const result = removeAllMarkedBlocks(current);
  if (result.removed === 0) {
    return result;
  }

  await writeFileAtomic(sshConfigPath, result.content, 0o600);
  return result;
}

export function upsertManagedHostBlock(content: string, hostAlias: string, options: SshConfigOptions): string {
  const begin = `${SSH_CONFIG_BEGIN} ${hostAlias}`;
  const end = `${SSH_CONFIG_END} ${hostAlias}`;
  const withoutExisting = removeMarkedBlock(content, begin, end).trimEnd();
  const block = [
    begin,
    `Host ${hostAlias}`,
    '  HostName 127.0.0.1',
    `  User ${options.remoteUser}`,
    `  IdentityFile ${quoteSshConfigValue(options.identityFile)}`,
    '  IdentitiesOnly yes',
    '  StrictHostKeyChecking no',
    '  UserKnownHostsFile /dev/null',
    '  LogLevel ERROR',
    `  ProxyCommand ${quoteSshConfigValue(options.dockerPath)} exec -i -u 0 ${options.containerId} ${quoteSshConfigValue(options.sshdPath)} -i -f ${quoteSshConfigValue(options.containerSshdConfig)}`,
    end,
    ''
  ].join('\n');

  return `${withoutExisting}${withoutExisting ? '\n\n' : ''}${block}`;
}

export function removeManagedHostBlock(content: string, hostAlias: string): string {
  return removeMarkedBlock(content, `${SSH_CONFIG_BEGIN} ${hostAlias}`, `${SSH_CONFIG_END} ${hostAlias}`);
}

export function removeMarkedBlock(content: string, begin: string, end: string): string {
  const escapedBegin = escapeRegExp(begin);
  const escapedEnd = escapeRegExp(end);
  return content.replace(new RegExp(`\\n?${escapedBegin}[\\s\\S]*?${escapedEnd}\\n?`, 'g'), '\n');
}

export function removeAllMarkedBlocks(content: string): { content: string; removed: number } {
  const pattern = new RegExp(`(?:\\r?\\n)?${escapeRegExp(SSH_CONFIG_BEGIN)}[\\s\\S]*?${escapeRegExp(SSH_CONFIG_END)}[^\\n]*(?:\\r?\\n)?`, 'g');
  let removed = 0;
  const next = content.replace(pattern, () => {
    removed += 1;
    return '\n';
  });

  return {
    content: next.trimEnd(),
    removed
  };
}

export function parseMarker(output: string, key: string): string | undefined {
  const line = output.split(/\r?\n/).find((entry) => entry.startsWith(`${key}=`));
  return line?.slice(key.length + 1).trim();
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function quoteSshConfigValue(value: string): string {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) {
    return value;
  }

  return `"${value.replace(/(["\\$`])/g, '\\$1')}"`;
}
