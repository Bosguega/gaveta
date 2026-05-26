import { createAiClient, getApiKey, getApiModel, getAiMode, getAiBaseUrl } from '@bosguega/ai-core';
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

async function createConfiguredClient() {
  const mode = await getAiMode();

  if (mode === 'local') {
    logger.log('LLM', 'Modo local: usando Ollama');
    return createAiClient();
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('Configure a chave da API nas Configurações.');
  }

  logger.log('LLM', 'Modo online: usando ' + (apiKey.startsWith('AIza') ? 'Gemini' : 'OpenAI'));
  return createAiClient({
    apiKey,
    model: await getApiModel(),
  });
}

function sanitizePromptInput(text: string, maxLength: number): string {
  let sanitized = Array.from(text)
    .filter((char) => {
      if (char === '\n' || char === '\r' || char === '\t' || char === ' ') {
        return true;
      }
      const code = char.charCodeAt(0);
      return code >= 0x21 && code <= 0x7e;
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

  const ai = await createConfiguredClient();
  const response = await ai.generateText({
    userPrompt: `Resuma ou organize as informacoes abaixo de forma clara. Use apenas os dados fornecidos.\n\n${notes}`,
    temperature: 0.7,
    maxTokens: 2048,
  });

  const summary = response.text.trim();
  if (!summary) {
    throw new Error('A API nao retornou resumo.');
  }

  return summary;
}

export async function generateAnswer(question: string, results: SearchResult[]): Promise<{ answer: string; usedIds: number[] }> {
  if (!question.trim()) {
    throw new Error('Pergunta vazia nao pode gerar resposta.');
  }

  // Formata as notas com [MEMORY_ID: N] para a LLM identificar cada uma
  const formattedNotes = results.map(
    (result) => `[MEMORY_ID: ${result.note.id}]\n${result.note.content}`
  );

  const sanitizedQuestion = sanitizePromptInput(question, MAX_QUESTION_LENGTH);
  const context = formattedNotes.length
    ? formattedNotes
      .map((note) => sanitizePromptInput(note, MAX_NOTE_LENGTH))
      .join('\n')
    : 'Nenhuma nota relevante encontrada.';

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

  const ai = await createConfiguredClient();
  const response = await ai.generateText({
    userPrompt: prompt,
    temperature: 0.7,
    maxTokens: 2048,
  });

  return parseAnswerResponse(response.text);
}

function parseAnswerResponse(rawResponse: string): { answer: string; usedIds: number[] } {
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