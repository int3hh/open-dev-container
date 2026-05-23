import * as os from 'node:os';
import * as path from 'node:path';
import { OpenDevContainerError } from './errors';
import type { DockerContainer, DockerInspect, DockerMount } from './types';

export function expandHome(value: string): string {
  if (value === '~') {
    return os.homedir();
  }

  if (value.startsWith('~/')) {
    return path.join(os.homedir(), value.slice(2));
  }

  return value;
}

export function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeContainerName(value: string): string {
  const firstName = value.split(',')[0]?.trim() || 'container';
  return firstName.replace(/^\/+/, '') || 'container';
}

export function createHostAlias(container: Pick<DockerContainer, 'Names' | 'ID'>): string {
  const name = normalizeContainerName(container.Names);
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'container';

  return `odc-${slug}-${container.ID.slice(0, 6)}`;
}

export function ensureSafeRemoteUser(remoteUser: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(remoteUser)) {
    throw new OpenDevContainerError(
      'INVALID_REMOTE_USER',
      `The configured remote user "${remoteUser}" is not safe to write into SSH config.`,
      'Use a Unix username containing only letters, numbers, dot, underscore, or dash.'
    );
  }

  return remoteUser;
}

export function buildConnectionKey(input: {
  containerName: string;
  dockerPath: string;
  remoteUser: string;
  workspaceFolder: string;
  sshConfigPath: string;
}): string {
  return [input.containerName, input.dockerPath, input.remoteUser, input.workspaceFolder, input.sshConfigPath].join('|');
}

export function summarizeMounts(mounts: DockerMount[]): string {
  if (mounts.length === 0) {
    return 'none';
  }

  return mounts
    .map((mount) => {
      const source = mount.Source || 'unknown source';
      const destination = mount.Destination || 'unknown destination';
      const type = mount.Type ? ` (${mount.Type})` : '';
      return `${source} -> ${destination}${type}`;
    })
    .join('; ');
}

export function formatMountTooltip(mounts: DockerMount[]): string {
  if (mounts.length === 0) {
    return 'No mounts';
  }

  return ['Mounts:', ...mounts.map((mount) => `- ${mount.Source || 'unknown source'} -> ${mount.Destination || 'unknown destination'}${mount.Type ? ` (${mount.Type})` : ''}`)].join('\n');
}

export function resolveWorkspaceFolder(inspect: DockerInspect, localWorkspace?: string): string {
  const mounts = inspect.Mounts || [];

  if (localWorkspace) {
    for (const mount of mounts) {
      if (mount.Type !== 'bind' || !mount.Source || !mount.Destination) {
        continue;
      }

      const relative = path.relative(mount.Source, localWorkspace);
      if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
        const remoteRelative = relative.split(path.sep).filter(Boolean).join('/');
        return remoteRelative ? `${trimTrailingSlash(mount.Destination)}/${remoteRelative}` : mount.Destination;
      }
    }
  }

  return inspect.Config?.WorkingDir || '/';
}

export function formatTimestamp(value: number): string {
  return new Date(value).toLocaleString();
}
