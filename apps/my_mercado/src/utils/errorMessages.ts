/**
 * Mensagens de erro padronizadas para a aplicação
 * Centraliza e padroniza todas as mensagens de erro mostradas ao usuário
 */

export const errorMessages = {
    // =========================
    // SCANNER & NFC-E
    // =========================

    QR_CODE_INVALID: "QR Code inválido. Verifique se é o QR Code da NFC-e.",
    QR_CODE_PROCESSING: "Erro ao processar QR Code. Tente novamente.",
    NFC_E_NOT_FOUND: "Não foi possível ler esta NFC-e. Ela pode ser:\n\n• De outro estado (só SP é suportado)\n• Muito antiga ou cancelada\n• Com problema temporário no servidor",
    NFC_E_PROXY_ERROR: "Não conseguimos acessar a NFC-e no momento. Tente novamente em alguns minutos ou use entrada manual.",
    NFC_E_NO_ITEMS: "Não foi possível extrair itens desta NFC-e. Verifique se a nota é válida.",
    NFC_E_DUPLICATE: "Esta nota já está no seu histórico desde {{date}}.",

    // =========================
    // SHOPPING LIST
    // =========================

    LIST_CREATE_FAILED: "Não foi possível criar a lista. Tente novamente.",
    LIST_ALREADY_EXISTS: "Já existe uma lista com este nome.",
    LIST_EMPTY_NAME: "Informe um nome válido para a lista.",
    LIST_DELETE_FAILED: "Não foi possível excluir a lista.",
    LIST_DELETE_LAST: "Não é possível excluir a última lista.",
    LIST_RENAME_FAILED: "Não foi possível renomear a lista.",
    LIST_RENAME_SUCCESS: "Lista renomeada!",
    LIST_MOVE_FAILED: "Não foi possível mover o item.",
    LIST_MOVE_SAME_LIST: "Selecione uma lista de destino diferente.",
    LIST_MOVE_DUPLICATE: "Já existe um item equivalente na lista de destino.",
    LIST_COPY_FAILED: "Não foi possível copiar o item.",
    LIST_COPY_SAME_LIST: "Selecione uma lista de destino diferente.",
    LIST_COPY_DUPLICATE: "Já existe um item equivalente na lista de destino.",
    LIST_CLEAR_CHECKED: "Itens comprados removidos!",
    LIST_CLEAR_ALL: "Lista limpa!",

    ITEM_ADD_FAILED: "Não foi possível adicionar o item.",
    ITEM_ADD_SUCCESS: "Item adicionado!",
    ITEM_EMPTY_NAME: "Digite o nome do item para adicionar.",
    ITEM_ALREADY_EXISTS: "Este item já está pendente na lista.",
    ITEM_REMOVE_FAILED: "Não foi possível remover o item.",
    ITEM_REMOVE_SUCCESS: "Item removido!",
    ITEM_NOT_FOUND: "Item não encontrado.",

    // =========================
    // COLLABORATIVE LIST
    // =========================

    COLLAB_NOT_AUTHENTICATED: "Faça login para usar listas colaborativas.",
    COLLAB_CREATE_FAILED: "Não foi possível criar a lista colaborativa.",
    COLLAB_CREATE_SUCCESS: "Lista colaborativa criada!",
    COLLAB_JOIN_FAILED: "Código inválido ou sem permissão para entrar na lista.",
    COLLAB_JOIN_SUCCESS: "Lista colaborativa conectada!",
    COLLAB_RENAME_FAILED: "Não foi possível renomear a lista colaborativa.",
    COLLAB_RENAME_SUCCESS: "Lista renomeada!",
    COLLAB_DELETE_FAILED: "Não foi possível excluir a lista colaborativa.",
    COLLAB_ADD_ITEM_FAILED: "Não foi possível adicionar item na lista colaborativa.",
    COLLAB_NO_LIST_SELECTED: "Crie ou entre em uma lista colaborativa primeiro.",
    COLLAB_MEMBER_REMOVE_FAILED: "Não foi possível remover membro.",
    COLLAB_MEMBER_REMOVE_SUCCESS: "Membro removido da lista.",
    COLLAB_MEMBER_ROLE_FAILED: "Não foi possível atualizar permissão.",
    COLLAB_MEMBER_ROLE_SUCCESS: "Permissão atualizada.",
    COLLAB_OWNERSHIP_TRANSFER_FAILED: "Não foi possível transferir ownership.",
    COLLAB_OWNERSHIP_TRANSFER_SUCCESS: "Ownership transferido com sucesso.",
    COLLAB_LEAVE_FAILED: "Não foi possível sair da lista.",
    COLLAB_LEAVE_SUCCESS: "Você saiu da lista colaborativa.",
    COLLAB_OWNER_CANNOT_LEAVE: "Owner não pode sair da própria lista. Exclua ou transfira a lista.",
    COLLAB_COPY_CODE_FAILED: "Não foi possível copiar o código.",
    COLLAB_COPY_CODE_SUCCESS: "Código copiado!",
    COLLAB_REGENERATE_CODE_FAILED: "Não foi possível gerar novo código.",
    COLLAB_REGENERATE_CODE_SUCCESS: "Novo código gerado e copiado!",

    // =========================
    // DICTIONARY
    // =========================

    DICTIONARY_UPDATE_FAILED: "Erro ao salvar alterações.",
    DICTIONARY_DELETE_FAILED: "Erro ao remover item.",
    DICTIONARY_CLEAR_FAILED: "Erro ao limpar dicionário.",
    DICTIONARY_NO_CHANGES: "Nenhuma alteração para salvar.",

    // =========================
    // CANONICAL PRODUCTS
    // =========================

    PRODUCT_CREATE_FAILED: "Erro ao criar produto.",
    PRODUCT_UPDATE_FAILED: "Erro ao atualizar produto.",
    PRODUCT_DELETE_FAILED: "Erro ao remover produto.",
    PRODUCT_MERGE_FAILED: "Erro ao mesclar produtos.",
    PRODUCT_ALREADY_EXISTS: "Já existe um produto com este nome ou slug.",
    PRODUCT_INVALID_NAME: "Informe um nome válido para o produto.",
    PRODUCT_INVALID_SLUG: "Informe um slug válido para o produto.",

    // =========================
    // BACKUP & RESTORE
    // =========================

    BACKUP_CREATE_FAILED: "Erro ao criar backup.",
    BACKUP_RESTORE_FAILED: "Erro ao restaurar backup.",
    BACKUP_INVALID_FILE: "Arquivo inválido! Selecione um arquivo .json",
    BACKUP_CORRUPTED: "Arquivo de backup corrompido.",
    BACKUP_NO_DATA: "Backup vazio ou sem dados válidos.",
    EXPORT_FAILED: "Erro ao exportar dados.",
    IMPORT_FAILED: "Erro ao importar dados.",

    // =========================
    // AUTH & CONNECTION
    // =========================

    AUTH_LOGIN_FAILED: "Erro ao fazer login. Verifique suas credenciais.",
    AUTH_REGISTER_FAILED: "Erro ao criar conta. Tente novamente.",
    AUTH_LOGOUT_FAILED: "Erro ao encerrar sessão.",
    AUTH_SESSION_INVALID: "Sessão inválida. Faça login novamente.",
    CONNECTION_ERROR: "Erro de conexão. Verifique sua internet.",
    CONNECTION_TIMEOUT: "Tempo de conexão esgotado. Tente novamente.",
    SERVER_ERROR: "Erro no servidor. Tente novamente em alguns minutos.",
    SUPABASE_NOT_CONFIGURED: "Supabase não configurado. Verifique as variáveis de ambiente.",

    // =========================
    // AI & API
    // =========================

    AI_NOT_CONFIGURED: "API Key não configurada. Vá em configurações e informe sua chave.",
    AI_CONNECTION_FAILED: "Falha na conexão com IA. Verifique sua chave e modelo.",
    AI_PROCESSING_FAILED: "Erro ao processar com IA. Usando fallback.",
    AI_INVALID_RESPONSE: "Resposta inválida da IA. Tente novamente.",
    AI_RATE_LIMIT: "Limite de requisições atingido. Aguarde alguns segundos.",
    API_KEY_INVALID: "API Key inválida. Verifique e tente novamente.",
    API_KEY_REQUIRED: "Por favor, informe a API Key.",

    // =========================
    // SETTINGS
    // =========================

    SETTINGS_SAVE_FAILED: "Erro ao salvar configurações.",
    SETTINGS_CLEAR_HISTORY_FAILED: "Erro ao limpar histórico.",
    SETTINGS_CLEAR_DICTIONARY_FAILED: "Erro ao limpar dicionário.",
    SETTINGS_CLEAR_PRODUCTS_FAILED: "Erro ao limpar produtos canônicos.",
    SETTINGS_SYNC_FAILED: "Não foi possível sincronizar listas agora.",
    SETTINGS_SYNC_REQUIRED: "Ative a sincronização de listas para continuar.",
    SETTINGS_TEST_FAILED: "Falha ao testar conexão. Verifique a chave e o modelo.",

    // =========================
    // GENERIC
    // =========================

    SAVE_FAILED: "Não foi possível salvar. Verifique sua conexão.",
    LOAD_FAILED: "Não foi possível carregar os dados.",
    DELETE_FAILED: "Não foi possível remover.",
    UPDATE_FAILED: "Não foi possível atualizar.",
    PROCESS_FAILED: "Não foi possível processar.",
    UNKNOWN_ERROR: "Ocorreu um erro inesperado. Tente novamente.",
    OPERATION_FAILED: "Não foi possível completar a operação.",
    PERMISSION_DENIED: "Você não tem permissão para esta ação.",
    NOT_FOUND: "Item não encontrado.",
    VALIDATION_ERROR: "Verifique os campos e tente novamente.",
    FIELD_REQUIRED: "{{field}} é obrigatório.",
} as const;

/**
 * Substitui placeholders em uma mensagem
 * @param template - Template da mensagem
 * @param params - Parâmetros para substituição
 * @returns Mensagem formatada
 */
export function formatErrorMessage(
    template: string,
    params: Record<string, string | number> = {}
): string {
    return Object.entries(params).reduce(
        (msg, [key, value]) => msg.replace(`{{${key}}}`, String(value)),
        template
    );
}

/**
 * Tipo para chaves de mensagens de erro
 */
export type ErrorMessageKey = keyof typeof errorMessages;
