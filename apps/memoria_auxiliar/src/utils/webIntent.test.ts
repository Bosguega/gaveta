import { describe, expect, it } from 'vitest';
import { isWebSearchRequested } from './webIntent';

const SHOULD_ENABLE = [
  'Pesquise na web sobre PGlite',
  'Busque na internet informações atuais sobre o Blender',
  'Procure online se essa informação ainda é válida',
  'Veja na web quanto custa atualmente',
  'Pesquise na internet sobre o assunto dessas notas',
  'Consulte a web para comparar isso com o que está nas minhas notas',
  'Pesquise na web o que existe hoje sobre esse tema',
  'Verifique na internet se a informação das notas ainda é atual',
  'Procure na web informações atuais sobre isso',
  'Busque na web os preços atualizados do produto X',
  // notas
  'Pesquise na web sobre o assunto dessas notas',
  'Com base nessas notas, pesquise na internet se isso ainda é válido',
  'Veja na internet o que existe atualmente sobre esse assunto',
  'Consulte a web para comparar as notas com a situação real',
  // variação de caixa e pontuação
  'PESQUISE NA WEB SOBRE PGLITE',
  'pesquise na web sobre pglite.',
  'Busque na Internet (informações atuais) sobre o Blender!',
  '  pesquise   na   web   sobre PGlite  ',
];

const SHOULD_NOT_ENABLE = [
  // não liberar
  'O que minhas notas dizem sobre PGlite?',
  'Me explique PGlite',
  'Compare essas duas notas',
  'O que você sabe sobre Blender?',
  'Resuma os resultados da busca',
  'Existe alguma relação entre essas notas?',
  'Fale sobre o preço do Blender',
  // ambíguos -> false
  'Qual é o preço atual do produto X?',
  'O que há de mais novo sobre Rust?',
  'Pesquise sobre PGlite',
  'Busque informações sobre o Blender',
  'Procure por que o build falhou',
  'Verifique se o teste passou',
  'Consulte as minhas notas sobre o assunto',
  'Veja o que essas notas dizem',
  'olhe nas notas o que há sobre o projeto',
  'me dá a definição atualizada de PGlite',
];

describe('isWebSearchRequested', () => {
  it.each(SHOULD_ENABLE)('libera a web: %s', (question) => {
    expect(isWebSearchRequested(question)).toBe(true);
  });

  it.each(SHOULD_NOT_ENABLE)('nao libera a web: %s', (question) => {
    expect(isWebSearchRequested(question)).toBe(false);
  });

  it('nao libera quando a pergunta e vazia', () => {
    expect(isWebSearchRequested('')).toBe(false);
  });

  it('nao libera quando o verbo e a fonte ficam distantes', () => {
    const longe = `Pesquise ${'a'.repeat(80)} na web sobre o assunto`;
    expect(isWebSearchRequested(longe)).toBe(false);
  });
});