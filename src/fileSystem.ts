import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export async function writeFileAtomic(filePath: string, content: string, mode: number): Promise<void> {
  const directory = path.dirname(filePath);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });

  const tempPath = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  await fs.writeFile(tempPath, content, { mode });

  try {
    await fs.rename(tempPath, filePath);
  } catch (error: unknown) {
    if (process.platform === 'win32') {
      try {
        await fs.unlink(filePath);
      } catch {
        // Ignore delete failures and surface the original rename error.
      }
      await fs.rename(tempPath, filePath);
      return;
    }

    throw error;
  }

  await chmodQuiet(filePath, mode);
}

export async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readFileIfExists(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error: unknown) {
    if (typeof error === 'object' && error && 'code' in error && error.code === 'ENOENT') {
      return '';
    }

    throw error;
  }
}

export async function chmodQuiet(filePath: string, mode: number): Promise<void> {
  try {
    await fs.chmod(filePath, mode);
  } catch {
    // Best effort on platforms/filesystems that do not support POSIX chmod.
  }
}
