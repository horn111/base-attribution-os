export interface CommandResult {
  ok: boolean;
  message: string;
  data?: unknown;
}

export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

export function printResult(result: CommandResult, json = false): void {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(result.message);

  if (result.data !== undefined) {
    console.log(JSON.stringify(result.data, null, 2));
  }
}

export function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new CliError(`Missing required option: ${name}`);
  }

  return value;
}
