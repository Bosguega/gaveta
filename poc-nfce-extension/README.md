# POC 3 - Automação completa de captura de NFC-e

## Configuração local (POC)
Use `extension/manifest.json` (inclui file:// e localhost).

## Configuração de produção
Use `extension/manifest.production.json` substituindo `<MY_MERCADO_ORIGIN>` pela origem real do My Mercado (a identificar). Remova file:// e localhost.

## Fluxo
1. Host envia `nfce-import`.
2. Extensão valida URL (HTTPS, domínio, caminho ConsultaQRCode.aspx, param p).
3. Cria aba temporária `active:false`.
4. Captura texto por polling.
5. Valida conteúdo.
6. Envia resultado ao host.
7. Host confirma com `nfce-delivery-ack`.
8. Extensão fecha aba somente após confirmação.
9. Timeout de entrega: 5s.

## Testes
- Importação válida: sucesso.
- Domínio não autorizado: rejeitado.
- Caminho inválido: rejeitado.
- Timeout captura: 20s.
- Falha de entrega: timeout 5s + limpeza.
- Duas importações simultâneas: mapeadas por tab.id.
- Aba não fecha antes da confirmação: implementado.

Testes de Android/Vivaldi ainda pendentes no dispositivo.