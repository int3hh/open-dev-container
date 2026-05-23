import type { CommandErrorCode } from './types';

export class OpenDevContainerError extends Error {
  constructor(
    public readonly code: CommandErrorCode,
    message: string,
    public readonly detail?: string,
    public readonly exitCode?: number
  ) {
    super(message);
    this.name = 'OpenDevContainerError';
  }
}

export function formatDiagnostic(error: unknown): { code: CommandErrorCode; message: string; detail?: string } {
  if (error instanceof OpenDevContainerError) {
    return {
      code: error.code,
      message: error.message,
      detail: error.detail
    };
  }

  if (error instanceof Error) {
    return {
      code: 'UNKNOWN',
      message: error.message,
      detail: error.stack
    };
  }

  return {
    code: 'UNKNOWN',
    message: String(error)
  };
}

export function formatErrorDetail(error: unknown): string | undefined {
  if (error instanceof OpenDevContainerError) {
    return error.detail;
  }

  if (error instanceof Error) {
    return error.stack || error.message;
  }

  return String(error);
}
