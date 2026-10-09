import { describe, expect, it } from 'vitest';
import {
  SERVER_STATUS_LABELS,
  shouldLaunchServer,
  statusFromEmbeddingValidation,
  statusFromHealth,
  validateServerCommand,
  type LlamaServerStatus,
} from './llamaServerStatus';

const ALL_STATUSES: LlamaServerStatus[] = ['parado', 'encerrando', 'iniciando', 'executando', 'erro'];

describe('SERVER_STATUS_LABELS', () => {
  it('exposes the required states', () => {
    expect(SERVER_STATUS_LABELS.parado).toBe('Parado');
    expect(SERVER_STATUS_LABELS.encerrando).toBe('Encerrando...');
    expect(SERVER_STATUS_LABELS.iniciando).toBe('Iniciando...');
    expect(SERVER_STATUS_LABELS.executando).toBe('Em execução');
    expect(SERVER_STATUS_LABELS.erro).toBe('Erro');
  });
});

describe('shouldLaunchServer', () => {
  it('does not launch when the server is already running', () => {
    expect(shouldLaunchServer('executando')).toBe(false);
  });

  it('does not launch a second process while one is starting', () => {
    expect(shouldLaunchServer('iniciando')).toBe(false);
  });

  it('does not launch while the server is stopping', () => {
    expect(shouldLaunchServer('encerrando')).toBe(false);
  });

  it('launches when stopped or in error', () => {
    expect(shouldLaunchServer('parado')).toBe(true);
    expect(shouldLaunchServer('erro')).toBe(true);
  });
});

describe('statusFromHealth', () => {
  it('reports running only after a successful response', () => {
    expect(statusFromHealth(true)).toBe('executando');
    expect(statusFromHealth(false)).toBe('parado');
  });
});

describe('statusFromEmbeddingValidation', () => {
  it('rejects a server that answers but has the wrong dimension', () => {
    expect(statusFromEmbeddingValidation(false)).toBe('erro');
  });

  it('accepts a server with the expected dimension', () => {
    expect(statusFromEmbeddingValidation(true)).toBe('executando');
  });
});

describe('validateServerCommand', () => {
  it('accepts a command with quoted paths', () => {
    expect(
      validateServerCommand(
        '"C:\\Trabalhos\\Modelos\\bin\\llama-server.exe" -m "C:\\Modelos\\bge-m3.gguf" --port 8081',
      ),
    ).toBeNull();
  });

  it('accepts a command without quotes', () => {
    expect(validateServerCommand('llama-server.exe -m model.gguf')).toBeNull();
  });

  it('rejects a blank command', () => {
    expect(validateServerCommand('')).toBeTruthy();
    expect(validateServerCommand('   ')).toBeTruthy();
  });

  it('rejects unbalanced quotes before touching the process layer', () => {
    expect(validateServerCommand('llama-server.exe -m "model.gguf')).toBeTruthy();
  });
});

describe('status coverage', () => {
  it('every status has a label', () => {
    for (const status of ALL_STATUSES) {
      expect(SERVER_STATUS_LABELS[status]).toBeTruthy();
    }
  });
});