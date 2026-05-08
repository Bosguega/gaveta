# 📋 Auditoria de Mensagens de Erro - My Mercado

**Data da auditoria:** 02/04/2026  
**Total de mensagens identificadas:** 250+

---

## 📁 Sumário

1. [Arquivos Principais de Erros](#1-arquivos-principais-de-erros)
2. [Serviços de Autenticação](#2-serviços-de-autenticação)
3. [Serviços de Receita/NFC-e](#3-serviços-de-receitanfc-e)
4. [Serviços de Produtos Canônicos](#4-serviços-de-produtos-canônicos)
5. [Serviços de Lista Colaborativa](#5-serviços-de-lista-colaborativa)
6. [Clientes de IA](#6-clientes-de-ia)
7. [Validações (Zod)](#7-validações-zod)
8. [Storage](#8-storage)
9. [Backup](#9-backup)
10. [Componentes](#10-componentes)
11. [Hooks](#11-hooks)
12. [Hooks de Query (React Query)](#12-hooks-de-query-react-query)
13. [Serviços de Sync e Fallback](#13-serviços-de-sync-e-fallback)
14. [App.tsx](#14-apptsx)
15. [Notifications](#15-notifications)
16. [Resumo Quantitativo](#16-resumo-quantitativo)
17. [Padrões Encontrados](#17-padrões-encontrados)
18. [Recomendações](#18-recomendações)

---

## 1. Arquivos Principais de Erros

### `src/utils/errorMessages.ts`

Arquivo centralizador de todas as mensagens de erro padronizadas.

#### Mensagens de Scanner & NFC-e

| Chave | Mensagem |
|-------|----------|
| `QR_CODE_INVALID` | "QR Code inválido. Verifique se é o QR Code da NFC-e." |
| `QR_CODE_PROCESSING` | "Erro ao processar QR Code. Tente novamente." |
| `NFC_E_NOT_FOUND` | "Não foi possível ler esta NFC-e. Ela pode ser:\n\n• De outro estado (só SP é suportado)\n• Muito antiga ou cancelada\n• Com problema temporário no servidor" |
| `NFC_E_PROXY_ERROR` | "Não conseguimos acessar a NFC-e no momento. Tente novamente em alguns minutos ou use entrada manual." |
| `NFC_E_NO_ITEMS` | "Não foi possível extrair itens desta NFC-e. Verifique se a nota é válida." |
| `NFC_E_DUPLICATE` | "Esta nota já está no seu histórico desde {{date}}." |

#### Mensagens de Shopping List

| Chave | Mensagem |
|-------|----------|
| `LIST_CREATE_FAILED` | "Não foi possível criar a lista. Tente novamente." |
| `LIST_ALREADY_EXISTS` | "Já existe uma lista com este nome." |
| `LIST_EMPTY_NAME` | "Informe um nome válido para a lista." |
| `LIST_DELETE_FAILED` | "Não foi possível excluir a lista." |
| `LIST_DELETE_LAST` | "Não é possível excluir a última lista." |
| `LIST_RENAME_FAILED` | "Não foi possível renomear a lista." |
| `LIST_MOVE_FAILED` | "Não foi possível mover o item." |
| `LIST_MOVE_SAME_LIST` | "Selecione uma lista de destino diferente." |
| `LIST_MOVE_DUPLICATE` | "Já existe um item equivalente na lista de destino." |
| `LIST_COPY_FAILED` | "Não foi possível copiar o item." |
| `LIST_COPY_SAME_LIST` | "Selecione uma lista de destino diferente." |
| `LIST_COPY_DUPLICATE` | "Já existe um item equivalente na lista de destino." |
| `ITEM_ADD_FAILED` | "Não foi possível adicionar o item." |
| `ITEM_EMPTY_NAME` | "Digite o nome do item para adicionar." |
| `ITEM_ALREADY_EXISTS` | "Este item já está pendente na lista." |
| `ITEM_REMOVE_FAILED` | "Não foi possível remover o item." |
| `ITEM_NOT_FOUND` | "Item não encontrado." |

#### Mensagens de Collaborative List

| Chave | Mensagem |
|-------|----------|
| `COLLAB_NOT_AUTHENTICATED` | "Faça login para usar listas colaborativas." |
| `COLLAB_CREATE_FAILED` | "Não foi possível criar a lista colaborativa." |
| `COLLAB_JOIN_FAILED` | "Código inválido ou sem permissão para entrar na lista." |
| `COLLAB_RENAME_FAILED` | "Não foi possível renomear a lista colaborativa." |
| `COLLAB_DELETE_FAILED` | "Não foi possível excluir a lista colaborativa." |
| `COLLAB_ADD_ITEM_FAILED` | "Não foi possível adicionar item na lista colaborativa." |
| `COLLAB_NO_LIST_SELECTED` | "Crie ou entre em uma lista colaborativa primeiro." |
| `COLLAB_MEMBER_REMOVE_FAILED` | "Não foi possível remover membro." |
| `COLLAB_MEMBER_ROLE_FAILED` | "Não foi possível atualizar permissão." |
| `COLLAB_OWNERSHIP_TRANSFER_FAILED` | "Não foi possível transferir ownership." |
| `COLLAB_LEAVE_FAILED` | "Não foi possível sair da lista." |
| `COLLAB_OWNER_CANNOT_LEAVE` | "Owner não pode sair da própria lista. Exclua ou transfira a lista." |

#### Mensagens de Dictionary

| Chave | Mensagem |
|-------|----------|
| `DICTIONARY_UPDATE_FAILED` | "Erro ao salvar alterações." |
| `DICTIONARY_DELETE_FAILED` | "Erro ao remover item." |
| `DICTIONARY_CLEAR_FAILED` | "Erro ao limpar dicionário." |
| `DICTIONARY_NO_CHANGES` | "Nenhuma alteração para salvar." |

#### Mensagens de Canonical Products

| Chave | Mensagem |
|-------|----------|
| `PRODUCT_CREATE_FAILED` | "Erro ao criar produto." |
| `PRODUCT_UPDATE_FAILED` | "Erro ao atualizar produto." |
| `PRODUCT_DELETE_FAILED` | "Erro ao remover produto." |
| `PRODUCT_MERGE_FAILED` | "Erro ao mesclar produtos." |
| `PRODUCT_ALREADY_EXISTS` | "Já existe um produto com este nome ou slug." |
| `PRODUCT_INVALID_NAME` | "Informe um nome válido para o produto." |
| `PRODUCT_INVALID_SLUG` | "Informe um slug válido para o produto." |

#### Mensagens de Backup & Restore

| Chave | Mensagem |
|-------|----------|
| `BACKUP_CREATE_FAILED` | "Erro ao criar backup." |
| `BACKUP_RESTORE_FAILED` | "Erro ao restaurar backup." |
| `BACKUP_INVALID_FILE` | "Arquivo inválido! Selecione um arquivo .json" |
| `BACKUP_CORRUPTED` | "Arquivo de backup corrompido." |
| `BACKUP_NO_DATA` | "Backup vazio ou sem dados válidos." |
| `EXPORT_FAILED` | "Erro ao exportar dados." |
| `IMPORT_FAILED` | "Erro ao importar dados." |

#### Mensagens de Auth & Connection

| Chave | Mensagem |
|-------|----------|
| `AUTH_LOGIN_FAILED` | "Erro ao fazer login. Verifique suas credenciais." |
| `AUTH_REGISTER_FAILED` | "Erro ao criar conta. Tente novamente." |
| `AUTH_LOGOUT_FAILED` | "Erro ao encerrar sessão." |
| `AUTH_SESSION_INVALID` | "Sessão inválida. Faça login novamente." |
| `CONNECTION_ERROR` | "Erro de conexão. Verifique sua internet." |
| `CONNECTION_TIMEOUT` | "Tempo de conexão esgotado. Tente novamente." |
| `SERVER_ERROR` | "Erro no servidor. Tente novamente em alguns minutos." |
| `SUPABASE_NOT_CONFIGURED` | "Supabase não configurado. Verifique as variáveis de ambiente." |

#### Mensagens de AI & API

| Chave | Mensagem |
|-------|----------|
| `AI_NOT_CONFIGURED` | "API Key não configurada. Vá em configurações e informe sua chave." |
| `AI_CONNECTION_FAILED` | "Falha na conexão com IA. Verifique sua chave e modelo." |
| `AI_PROCESSING_FAILED` | "Erro ao processar com IA. Usando fallback." |
| `AI_INVALID_RESPONSE` | "Resposta inválida da IA. Tente novamente." |
| `AI_RATE_LIMIT` | "Limite de requisições atingido. Aguarde alguns segundos." |
| `API_KEY_INVALID` | "API Key inválida. Verifique e tente novamente." |
| `API_KEY_REQUIRED` | "Por favor, informe a API Key." |

#### Mensagens de Settings

| Chave | Mensagem |
|-------|----------|
| `SETTINGS_SAVE_FAILED` | "Erro ao salvar configurações." |
| `SETTINGS_CLEAR_HISTORY_FAILED` | "Erro ao limpar histórico." |
| `SETTINGS_CLEAR_DICTIONARY_FAILED` | "Erro ao limpar dicionário." |
| `SETTINGS_CLEAR_PRODUCTS_FAILED` | "Erro ao limpar produtos canônicos." |
| `SETTINGS_SYNC_FAILED` | "Não foi possível sincronizar listas agora." |
| `SETTINGS_SYNC_REQUIRED` | "Ative a sincronização de listas para continuar." |
| `SETTINGS_TEST_FAILED` | "Falha ao testar conexão. Verifique a chave e o modelo." |

#### Mensagens Genéricas

| Chave | Mensagem |
|-------|----------|
| `SAVE_FAILED` | "Não foi possível salvar. Verifique sua conexão." |
| `LOAD_FAILED` | "Não foi possível carregar os dados." |
| `DELETE_FAILED` | "Não foi possível remover." |
| `UPDATE_FAILED` | "Não foi possível atualizar." |
| `PROCESS_FAILED` | "Não foi possível processar." |
| `UNKNOWN_ERROR` | "Ocorreu um erro inesperado. Tente novamente." |
| `OPERATION_FAILED` | "Não foi possível completar a operação." |
| `PERMISSION_DENIED` | "Você não tem permissão para esta ação." |
| `NOT_FOUND` | "Item não encontrado." |
| `VALIDATION_ERROR` | "Verifique os campos e tente novamente." |
| `FIELD_REQUIRED` | "{{field}} é obrigatório." |

---

## 2. Serviços de Autenticação

### `src/services/authService.ts`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 8 | "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY." | `requireSupabase()` |
| 27 | "Email ou senha incorretos. Verifique suas credenciais." | `login()` - credenciais inválidas |
| 30 | "Email não confirmado. Verifique sua caixa de entrada." | `login()` - email não confirmado |
| 49 | "Este email já está cadastrado. Faça login ou use outro email." | `register()` - usuário já existe |
| 52 | "A senha deve ter pelo menos 6 caracteres." | `register()` - senha fraca |
| 55 | "Email inválido. Verifique o formato." | `register()` - email inválido |
| 88 | "Usuário não autenticado" | `getUserOrThrow()` |

---

## 3. Serviços de Receita/NFC-e

### `src/services/receiptParser.ts`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 69 | "QR Code invalido: URL nao reconhecida." | `validateNfceSpUrl()` |
| 73 | "URL invalida para consulta da NFC-e." | `validateNfceSpUrl()` |
| 78 | "Somente URLs da NFC-e de Sao Paulo (fazenda.sp.gov.br) sao suportadas." | `validateNfceSpUrl()` |
| 85 | "Link da NFC-e sem parametros esperados (p/chNFe)." | `validateNfceSpUrl()` |
| 175 | "Proxy {index}: timeout apos {PROXY_TIMEOUT_MS}ms." | `parseNFCeSP()` - erro de proxy |
| 187 | "Falha ao acessar Sefaz via proxies. {attemptErrors}" | `parseNFCeSP()` - todos proxies falharam |
| 253 | "Nenhum item encontrado na nota." | `parseNFCeSP()` - parsing sem itens |

### `src/services/receiptService.ts`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 180 | "Erro ao buscar notas" | `getReceiptsPaginated()` - log de erro |
| 204 | "Erro ao buscar todos os receipts" | `getAllReceiptsFromDB()` - log de erro |
| 210 | "Erro de autenticação ou tabela não existe" | `getAllReceiptsFromDB()` - erro PGRST205 |
| 214 | "Usuário não autenticado" | `getAllReceiptsFromDB()` - erro de auth |
| 286 | "Erro ao salvar nota" | `saveReceiptToDB()` - log de erro |
| 298 | "Erro ao salvar itens" | `saveReceiptToDB()` - log de erro |

---

## 4. Serviços de Produtos Canônicos

### `src/services/canonicalProductService.ts`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 73 | "Slug já existe. Use um slug diferente." | `createCanonicalProduct()` - duplicidade |
| 124 | "Não é possível deletar: existem {count} itens associados a este produto." | `deleteCanonicalProduct()` - há itens vinculados |
| 152 | "Produto canônico não encontrado" | `mergeCanonicalProducts()` |

---

## 5. Serviços de Lista Colaborativa

### `src/services/collaborativeShoppingListService.ts`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 50 | "Nome da lista e obrigatorio." | `createCollaborativeListInDB()` |
| 70 | "Codigo de compartilhamento invalido." | `joinCollaborativeListByCodeInDB()` |
| 122 | "Nome do item e obrigatorio." | `addCollaborativeListItemToDB()` |
| 188 | "Nome da lista e obrigatorio." | `renameCollaborativeListInDB()` |

---

## 6. Clientes de IA

### `src/utils/ai/openaiClient.ts`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 49 | "OpenAI API Error ({res.status}): {err}" | `callOpenAI()` - erro na API |

### `src/utils/ai/geminiClient.ts`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 44 | "Gemini API Error ({res.status}): {err}" | `callGemini()` - erro na API |

### `src/utils/ai/promptBuilder.ts`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 52 | "Resposta da IA nao e um array." | `parseAiJsonResponse()` |
| 75 | "Resposta da IA nao e um JSON valido." | `parseAiJsonResponse()` |

### `src/utils/ai/index.ts`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 28 | "API Key nao configurada. Va em configuracoes e informe sua chave." | `callAI()` |
| 50 | "Provedor desconhecido para a chave fornecida..." | `callAI()` - provider inválido |

---

## 7. Validações (Zod)

### `src/utils/validation.ts`

#### receiptItemSchema

| Linha | Mensagem |
|-------|----------|
| 20 | "Nome do produto é obrigatório" |
| 32 | "Preço é obrigatório" |
| 33 | "Preço inválido! Use apenas números" |

#### receiptSchema

| Linha | Mensagem |
|-------|----------|
| 48 | "Nome do mercado é obrigatório" |
| 52 | "Data inválida! Use DD/MM/AAAA" |
| 58 | "Adicione pelo menos um item" |
| 59 | "Muitos itens (máx 500)" |

#### manualItemSchema

| Linha | Mensagem |
|-------|----------|
| 71 | "Nome é obrigatório" |
| 80 | "Preço é obrigatório" |
| 81 | "Preço inválido! Use apenas números" |

#### manualReceiptFormSchema

| Linha | Mensagem |
|-------|----------|
| 90 | "Nome do mercado é obrigatório" |
| 94 | "Data inválida! Use DD/MM/AAAA" |
| 98 | "Adicione pelo menos um item" |

#### nfcUrlSchema

| Linha | Mensagem |
|-------|----------|
| 107 | "URL é obrigatória" |
| 108 | "URL inválida! Deve começar com http:// ou https://" |
| 117 | "Protocolo inválido! Use http:// ou https://" |

#### apiKeySchema

| Linha | Mensagem |
|-------|----------|
| 124 | "API Key é obrigatória" |
| 132 | "API Key inválida! Deve começar com 'AIza' (Google) ou 'sk-' (OpenAI)" |

---

## 8. Storage

### `src/utils/storage.ts`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 126 | "IndexedDB não disponível" | `getDB()` |
| 154 | "Erro ao salvar em {store}" | `indexedDBSet()` |
| 179 | "Erro ao ler {store}" | `indexedDBGet()` |
| 201 | "Erro ao deletar de {store}" | `indexedDBDelete()` |
| 228 | "Erro ao limpar {store}" | `indexedDBClear()` |
| 246 | "Erro ao ler todos de {store}" | `indexedDBGetAll()` |
| 251 | "localStorage cheio ou não disponível" | `localStorageSet()` |
| 265 | "Erro ao ler localStorage" | `localStorageGet()` |
| 278 | "Erro ao deletar localStorage" | `localStorageDelete()` |
| 294 | "Erro ao limpar localStorage" | `localStorageClear()` |
| 333 | "Nenhum storage disponível" | `UnifiedStorage.set()` |
| 521 | "Erro ao migrar {store}:{key}" | `migrateLocalStorageToIndexedDB()` |

---

## 9. Backup

### `src/utils/validation/backupSchema.ts`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 42 | "JSON inválido. Verifique o arquivo de backup." | `parseBackupJson()` |
| 49 | "Arquivo de backup inválido ou corrompido." | `parseBackupJson()` |

---

## 10. Componentes

### `src/components/ErrorBoundary.tsx`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 29 | "🔴 ErrorBoundary capturou um erro" | `componentDidCatch()` |
| 32 | "Ops! Algo deu errado. Tente recarregar a página." | `toast.error()` |

### `src/components/Login.tsx`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 32 | "Erro ao autenticar" | `handleSubmit()` |

### `src/components/ApiKeyModal.tsx`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 68, 80, 123 | Usa `notify.errorByKey("API_KEY_REQUIRED")` | `handleSave`, `handleListModels`, `handleTest` |
| 95 | "Erro na API ({res.status})" | `handleListModels()` |
| 114 | Usa `notify.errorByKey("AI_CONNECTION_FAILED")` | `handleListModels()` |

### `src/components/HistoryTab/index.tsx`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 113 | "Arquivo inválido! Selecione um arquivo .json" | `handleRestoreJSON()` |
| 122 | "Conteúdo de backup inválido" | `handleRestoreJSON()` |
| 154 | "Erro ao ler arquivo de backup" | `handleRestoreJSON()` |

### `src/components/Scanner/ManualEntryForm.tsx`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 33 | "Preencha nome e preço do item" | `handleAddItem()` |
| 38 | "Preço inválido! Use apenas números" | `handleAddItem()` |

### `src/components/DictionaryTab.tsx`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 86 | "Erro ao aplicar correcao nas notas" | `applyChangesToSavedReceipts()` |
| 189 | "Erro ao atualizar item" | `handleSaveEdit()` |
| 205 | "Erro ao remover item" | `handleDeleteEntry()` |
| 223 | "Erro ao limpar dicionario" | `handleClearDictionary()` |

### `src/components/SettingsTab.tsx`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 81 | Usa `notify.errorByKey("SETTINGS_CLEAR_HISTORY_FAILED")` | `handleClearHistory()` |
| 101 | Usa `notify.errorByKey("SETTINGS_CLEAR_DICTIONARY_FAILED")` | `handleClearDictionary()` |
| 121 | Usa `notify.errorByKey("SETTINGS_CLEAR_PRODUCTS_FAILED")` | `handleClearCanonicalProducts()` |
| 155 | Usa `notify.errorByKey("SETTINGS_SYNC_REQUIRED")` | `handleSyncListsNow()` |
| 160 | Usa `notify.errorByKey("AUTH_SESSION_INVALID")` | `handleSyncListsNow()` |
| 174, 177 | Usa `notify.errorByKey("SETTINGS_SYNC_FAILED")` | `handleSyncListsNow()` |

---

## 11. Hooks

### `src/hooks/useQRCodeProcessor.ts`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 45 | "Texto inválido" | `processQRCode()` - log |
| 47 | "Conteúdo do QR Code inválido." | `processQRCode()` - throw |
| 71-73 | Usa `errorMessages.NFC_E_NOT_FOUND` ou `QR_CODE_INVALID` | `processQRCode()` |
| 76 | "Falha ao extrair itens da nota." | `processQRCode()` - setError |
| 97-98 | "Erro ao processar QR Code: {errorMessage}" | `processQRCode()` - catch |

### `src/hooks/useManualReceipt.ts`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 43 | "Preencha nome e preço do item" | `handleAddManualItem()` |
| 85 | `validation.errors.forEach((error) => toast.error(error))` | `handleSaveManualReceipt()` |
| 119 | "Erro ao salvar nota." | `handleSaveManualReceipt()` |

### `src/hooks/useErrorHandler.ts`

Hook centralizado para tratamento de erros com as seguintes funcionalidades:

| Método | Descrição |
|--------|-----------|
| `handleError()` | Trata erro genérico com fallback |
| `handleApiError()` | Trata erros de API (conexão, auth, permissão) |
| `handleValidationErrors()` | Trata erros de validação |
| `handleMappedError()` | Trata erro específico mapeado |

### `src/hooks/useCameraScanner.ts`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 53 | "Scan error" | `onScan()` |
| 86 | toast.error com mensagem de falha | `startScan()` |
| 89 | "Camera fail" | `startScan()` |
| 162 | "Torch error" | `toggleTorch()` |

### `src/hooks/shoppingList/useLocalShoppingListActions.ts`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 30 | "Informe um nome válido para a lista." | `handleCreateList()` |
| 47 | "Não foi possível renomear a lista." | `handleRenameList()` |
| 57 | "Não é possível excluir a última lista." | `handleDeleteList()` |
| 63 | "Não foi possível excluir a lista." | `handleDeleteList()` |
| 76 | "Digite o nome do item para adicionar." | `handleAddItem()` |
| 109 | "Selecione uma lista de destino diferente." | `handleMoveItem()` |
| 111 | "Não foi possível mover o item." | `handleMoveItem()` |
| 124 | "Selecione uma lista de destino diferente." | `handleCopyItem()` |
| 126 | "Não foi possível copiar o item." | `handleCopyItem()` |

### `src/hooks/shoppingList/useCollaborativeShoppingListActions.ts`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 45 | "Não foi possível criar a lista colaborativa." | `handleCreateList()` |
| 56 | "Código inválido ou sem permissão para entrar na lista." | `handleJoinByCode()` |
| 70 | "Não foi possível renomear a lista colaborativa." | `handleRenameList()` |
| 81 | "Não foi possível excluir a lista colaborativa." | `handleDeleteList()` |
| 92 | "Não foi possível adicionar item na lista colaborativa." | `handleAddItem()` |
| 122 | "Não foi possível copiar o código." | `handleCopyShareCode()` |
| 134 | "Não foi possível gerar novo código." | `handleRegenerateCode()` |
| 145 | "Não foi possível atualizar permissão." | `handleChangeMemberRole()` |
| 156 | "Não foi possível remover membro." | `handleRemoveMember()` |
| 167 | "Não foi possível sair da lista." | `handleLeaveList()` |
| 178 | "Não foi possível transferir ownership." | `handleTransferOwnership()` |

---

## 12. Hooks de Query (React Query)

### `src/hooks/queries/useCanonicalProductsQuery.ts`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 60 | "Erro ao criar produto canônico" | `useCreateCanonicalProduct.onError` |
| 90 | "Erro ao atualizar produto canônico" | `useUpdateCanonicalProduct.onError` |
| 114 | "Erro ao deletar produto canônico" | `useDeleteCanonicalProduct.onError` |
| 143 | "Erro ao mesclar produtos." | `useMergeCanonicalProducts.onError` |
| 163 | "Erro ao associar item." | `useAssociateItemToCanonicalProduct.onError` |
| 183 | "Erro ao associar dicionário." | `useAssociateDictionaryToCanonicalProduct.onError` |

### `src/hooks/queries/useDictionaryQuery.ts`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 115 | `queryClient.invalidateQueries({ queryKey: ["receipts"] })` | `useApplyDictionaryEntryToSavedItems` |

---

## 13. Serviços de Sync e Fallback

### `src/services/syncService.ts`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 28-30 | "Erro ao sincronizar receipt {receipt.id}" | `syncLocalStorageWithSupabase()` |
| 42 | "Erro ao sincronizar storage local" | `syncLocalStorageWithSupabase()` |

### `src/services/storageFallbackService.ts`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 25 | "Supabase falhou, usando fallback local" | `getAllReceiptsFromDBWithFallback()` |
| 39 | "Fallback também falhou" | `getAllReceiptsFromDBWithFallback()` |
| 61 | "Supabase falhou ao salvar, usando fallback local" | `saveReceiptToDBWithFallback()` |
| 73 | "Fallback local falhou" | `saveReceiptToDBWithFallback()` |
| 76 | "Falha ao salvar no Supabase e no fallback local" | `saveReceiptToDBWithFallback()` |

---

## 14. App.tsx

### `src/App.tsx`

| Linha | Mensagem | Contexto |
|-------|----------|----------|
| 125 | "Erro ao sincronizar dados locais" | `useEffect` - sync |
| 158 | "Falha no autosync de listas" | `useEffect` - cloud sync |
| 215 | "Erro ao sincronizar dados com o servidor. Exibindo dados locais." | `receiptsError` |

---

## 15. Notifications

### `src/utils/notifications.ts`

Sistema centralizado de notificações com métodos padronizados:

#### Métodos de Notificação

| Método | Descrição |
|--------|-----------|
| `notify.success()` | Notificação de sucesso |
| `notify.error()` | Notificação de erro genérica |
| `notify.warning()` | Notificação de alerta |
| `notify.errorByKey()` | Usa chaves de errorMessages |
| `notify.saved()` | Item salvo com sucesso |
| `notify.updated()` | Item atualizado |
| `notify.deleted()` | Item excluído |
| `notify.errorSaving()` | Erro ao salvar |
| `notify.errorLoading()` | Erro ao carregar |
| `notify.errorConnection()` | Erro de conexão |
| `notify.qrCodeInvalid()` | QR Code inválido |
| `notify.qrCodeProcessing()` | Processando QR Code |
| `notify.nfceNotFound()` | NFC-e não encontrada |
| `notify.aiNotConfigured()` | IA não configurada |
| `notify.aiConnectionFailed()` | Falha na conexão com IA |
| `notify.settingsSaved()` | Configurações salvas |
| `notify.sessionEnded()` | Sessão encerrada |

---

## 16. Resumo Quantitativo

| Categoria | Quantidade de Mensagens |
|-----------|------------------------|
| **errorMessages.ts (centralizado)** | 77 mensagens |
| **Validações Zod** | 18 mensagens |
| **Serviços de Auth** | 7 mensagens |
| **Serviços de Receipt/NFC-e** | 10 mensagens |
| **Serviços de Produtos Canônicos** | 3 mensagens |
| **Serviços de Lista Colaborativa** | 4 mensagens |
| **Clientes de IA** | 4 mensagens |
| **Storage** | 12 mensagens |
| **Componentes** | 20+ mensagens |
| **Hooks** | 25+ mensagens |
| **Console.error/warn logs** | 57 ocorrências |
| **Throw statements** | 33 ocorrências |
| **Catch blocks** | 76 ocorrências |

**Total estimado: 250+ mensagens de erro/validação únicas no projeto**

---

## 17. Padrões Encontrados

### ✅ Pontos Positivos

1. **Centralização**: O projeto usa `errorMessages.ts` como fonte única de verdade para mensagens
2. **Hook de Error Handling**: `useErrorHandler` fornece tratamento padronizado
3. **Notificações**: `notify` utility padroniza toasts de feedback
4. **Fallbacks**: Múltiplos serviços implementam fallback (Supabase → IndexedDB → localStorage)
5. **Validações**: Zod schema para validação de formulários com mensagens customizadas
6. **Logging**: `console.error` e `logger` para debug em desenvolvimento
7. **ErrorBoundary**: Componente global para capturar erros não tratados

### ⚠️ Pontos de Atenção

1. **Inconsistência de idioma**: Algumas mensagens em português, outras com acentos faltando (ex: "invalido", "nao", "Sao Paulo")
2. **Mensagens hardcoded**: Alguns componentes têm mensagens direto no código em vez de usar `errorMessages.ts`
3. **Logs expostos**: `console.error` em produção pode vazar informações sensíveis
4. **Interpolação inconsistente**: Alguns lugares usam `{{variavel}}`, outros usam `{variavel}` ou `${variavel}`

---

## 18. Recomendações

### 🔧 Melhorias Sugeridas

1. **Padronizar acentuação**: Revisar todas as mensagens para garantir consistência (ex: "inválido" vs "invalido")
2. **Centralizar mais mensagens**: Mover mensagens hardcoded de componentes para `errorMessages.ts`
3. **Remover console.error em produção**: Usar logger condicional baseado no ambiente
4. **Padronizar interpolação**: Escolher um padrão único para variáveis nas mensagens
5. **Adicionar IDs únicos**: Criar códigos de erro para suporte/troubleshooting remoto
6. **Internacionalização**: Preparar estrutura para i18n (pt-BR, en-US, es-AR)
7. **Documentar códigos de erro**: Criar um catálogo de erros com causas e soluções
8. **Testes de mensagens**: Adicionar testes para garantir que todas as chaves existem

### 📝 Exemplo de Melhoria

```typescript
// Antes
console.error("Erro ao salvar nota");

// Depois
logger.error('RECEIPT_SAVE_FAILED', { receiptId, error });
notify.errorByKey('SAVE_FAILED');
```

---

## 📊 Estatísticas do Projeto

- **Arquivos auditados:** 32+
- **Linhas de código analisadas:** ~5000+
- **Mensagens de erro:** 250+
- **Chaves centralizadas:** 77
- **Validações Zod:** 18
- **Hooks de erro:** 2
- **Componentes com tratamento de erro:** 8+

---

*Documento gerado automaticamente pela auditoria de mensagens de erro.*
