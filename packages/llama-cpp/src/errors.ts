export class LlamaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlamaError';
  }
}

export class LlamaNetworkError extends LlamaError {
  readonly causeError?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'LlamaNetworkError';
    this.causeError = cause;
  }
}

export class LlamaTimeoutError extends LlamaError {
  constructor(message: string) {
    super(message);
    this.name = 'LlamaTimeoutError';
  }
}

export class LlamaHttpError extends LlamaError {
  readonly status: number;
  readonly responseBody: string;

  constructor(status: number, responseBody: string) {
    super(`llama-server respondeu com HTTP ${status}: ${responseBody || '(sem corpo)'}`);
    this.name = 'LlamaHttpError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

export class LlamaInvalidResponseError extends LlamaError {
  constructor(message: string) {
    super(message);
    this.name = 'LlamaInvalidResponseError';
  }
}
