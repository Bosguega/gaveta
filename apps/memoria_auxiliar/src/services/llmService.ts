import { createLlamaClient } from '@bosguega/llama-cpp';
import { getChatConfig } from './tauriStore';
import type { SearchResult } from '../types';
import { logger } from '../utils/logger';

const MAX_NOTE_LENGTH = 5000;
const MAX_QUESTION_LENGTH = 2000;

const DANGEROUS_TOKENS = [
  'ignore all previous instructions',
  'ignore all prior instructions',
  'forget everything',
  'system prompt',
  'you are now',
  'act as if',
  'do not follow',
  'do not obey',
  'override',
];

async function generateText(prompt: string): Promise<string> {
  const { baseUrl, model } = await getChatConfig();
  const client = createLlamaClient({ baseUrl, defaultModel: model });

  logger.log('LLM', `Gerando texto via llama-server em ${client.baseUrl} (${model})`);

  const { content } = await client.chat({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    maxTokens: 2048,
  });

  return content;
}

function sanitizePromptInput(text: string, maxLength: number): string {
  let sanitized = Array.from(text)
    .filter((char) => {
      if (char === '\n' || char === '\r' || char === '\t') {
        return true;
      }
      const code = char.charCodeAt(0);
      return (code >= 0x20 && code <= 0x7e) || code >= 0xa0;
    })
    .join('');

  const lower = sanitized.toLowerCase();
  for (const token of DANGEROUS_TOKENS) {
    if (lower.includes(token)) {
      sanitized = sanitized.split(token).join('[redacted]');
    }
  }

  return Array.from(sanitized).slice(0, maxLength).join('');
}

export async function summarizeResults(results: SearchResult[]): Promise<string> {
  if (!results.length) {
    throw new Error('Nao ha resultados para resumir.');
  }

  const notes = results
    .map((result) => sanitizePromptInput(result.note.content, MAX_NOTE_LENGTH))
    .map((note, index) => `${index + 1}. ${note}`)
    .join('\n');

  const summary = (await generateText(
    `Resuma ou organize as informacoes abaixo de forma clara. Use apenas os dados fornecidos.\n\n${notes}`
  )).trim();
  if (!summary) {
    throw new Error('O llama-server nao retornou resumo.');
  }

  return summary;
}

/**
 * Monta o bloco de notas com o marcador `[MEMORY_ID: N]`, sanitizado e limitado.
 *
 * Compartilhado entre o caminho normal (`generateAnswer`) e o caminho com web,
 * para que ambos forneçam exatamente o mesmo contexto RAG ao modelo.
 */
export function buildNotesContext(results: SearchResult[]): string {
  if (!results.length) {
    return 'Nenhuma nota relevante encontrada.';
  }

  return results
    .map((result) => `[MEMORY_ID: ${result.note.id}]\n${result.note.content}`)
    .map((note) => sanitizePromptInput(note, MAX_NOTE_LENGTH))
    .join('\n');
}

/** Prepara a pergunta do usuário para ir ao modelo. */
export function sanitizeQuestion(question: string): string {
  return sanitizePromptInput(question, MAX_QUESTION_LENGTH);
}

export async function generateAnswer(question: string, results: SearchResult[]): Promise<{ answer: string; usedIds: number[] }> {
  if (!question.trim()) {
    throw new Error('Pergunta vazia nao pode gerar resposta.');
  }

  const context = buildNotesContext(results);
  const sanitizedQuestion = sanitizeQuestion(question);

  const prompt = `Voce e uma memoria auxiliar pessoal.

Sua funcao e responder APENAS com base nas memorias fornecidas abaixo.

REGRAS IMPORTANTES:
- Nao invente informacoes.
- Nao use conhecimento externo.
- Se nao encontrar a resposta nas memorias, diga: "Nao encontrei isso nas memorias."
- Nem toda memoria enviada precisa ser usada.
- Use apenas as memorias realmente relevantes.

MEMORIAS:
${context}

PERGUNTA:
${sanitizedQuestion}

Agora, responda a pergunta. Depois de responder, na linha final, informe SOMENTE os IDs das memorias realmente utilizadas neste formato exato:
USED_IDS: [id1, id2, id3]
`;

  return parseUsedIds(await generateText(prompt));
}

/**
 * Extrai a linha `USED_IDS: [...]` da resposta do modelo.
 *
 * Usa a última ocorrência do marcador, para que um texto intermediário (por
 * exemplo o raciocínio antes de uma tool call) não confunda o parser.
 */
export function parseUsedIds(rawResponse: string): { answer: string; usedIds: number[] } {
  const marker = 'USED_IDS: [';
  const markerIndex = rawResponse.lastIndexOf(marker);

  if (markerIndex < 0) {
    return {
      answer: rawResponse.trim(),
      usedIds: [],
    };
  }

  const afterMarker = rawResponse.slice(markerIndex + marker.length);
  const endIndex = afterMarker.indexOf(']');
  const idsText = endIndex >= 0 ? afterMarker.slice(0, endIndex) : '';
  const usedIds = idsText
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => Number.parseInt(id, 10))
    .filter((id) => Number.isFinite(id));

  return {
    answer: rawResponse.slice(0, markerIndex).trimEnd(),
    usedIds,
  };
}