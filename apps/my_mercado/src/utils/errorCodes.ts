/**
 * Códigos de erro para rastreabilidade e suporte
 * Usado para logging, analytics e troubleshooting
 *
 * Padrão de nomenclatura:
 * - {DOMÍNIO}_{NUMERO}
 * - Ex: NFC_E_001, LIST_001, AUTH_001
 */

export const ErrorCodes = {
    // =========================
    // SCANNER & NFC-E (NFC_E_XXX, QR_XXX)
    // =========================
    NFC_E_PARSE_FAILED: "NFC_E_001",
    NFC_E_PROXY_TIMEOUT: "NFC_E_002",
    NFC_E_NO_ITEMS: "NFC_E_003",
    NFC_E_DUPLICATE: "NFC_E_004",
    NFC_E_URL_INVALID: "NFC_E_005",
    NFC_E_STATE_NOT_SUPPORTED: "NFC_E_006",
    QR_CODE_INVALID: "QR_001",
    QR_CODE_PROCESSING_FAILED: "QR_002",

    // =========================
    // SHOPPING LIST (LIST_XXX, ITEM_XXX)
    // =========================
    LIST_CREATE_FAILED: "LIST_001",
    LIST_DUPLICATE_NAME: "LIST_002",
    LIST_EMPTY_NAME: "LIST_003",
    LIST_DELETE_FAILED: "LIST_004",
    LIST_DELETE_LAST: "LIST_005",
    LIST_RENAME_FAILED: "LIST_006",
    LIST_MOVE_FAILED: "LIST_007",
    LIST_MOVE_SAME_LIST: "LIST_008",
    LIST_MOVE_DUPLICATE: "LIST_009",
    LIST_COPY_FAILED: "LIST_010",
    LIST_COPY_SAME_LIST: "LIST_011",
    LIST_COPY_DUPLICATE: "LIST_012",
    ITEM_ADD_FAILED: "ITEM_001",
    ITEM_EMPTY_NAME: "ITEM_002",
    ITEM_ALREADY_EXISTS: "ITEM_003",
    ITEM_REMOVE_FAILED: "ITEM_004",
    ITEM_NOT_FOUND: "ITEM_005",

    // =========================
    // COLLABORATIVE LIST (COLLAB_XXX)
    // =========================
    COLLAB_NOT_AUTHENTICATED: "COLLAB_001",
    COLLAB_CREATE_FAILED: "COLLAB_002",
    COLLAB_JOIN_FAILED: "COLLAB_003",
    COLLAB_RENAME_FAILED: "COLLAB_004",
    COLLAB_DELETE_FAILED: "COLLAB_005",
    COLLAB_ADD_ITEM_FAILED: "COLLAB_006",
    COLLAB_NO_LIST_SELECTED: "COLLAB_007",
    COLLAB_MEMBER_REMOVE_FAILED: "COLLAB_008",
    COLLAB_MEMBER_ROLE_FAILED: "COLLAB_009",
    COLLAB_OWNERSHIP_TRANSFER_FAILED: "COLLAB_010",
    COLLAB_LEAVE_FAILED: "COLLAB_011",
    COLLAB_OWNER_CANNOT_LEAVE: "COLLAB_012",
    COLLAB_INVALID_CODE: "COLLAB_013",

    // =========================
    // DICTIONARY (DICT_XXX)
    // =========================
    DICTIONARY_UPDATE_FAILED: "DICT_001",
    DICTIONARY_DELETE_FAILED: "DICT_002",
    DICTIONARY_CLEAR_FAILED: "DICT_003",
    DICTIONARY_NO_CHANGES: "DICT_004",

    // =========================
    // CANONICAL PRODUCTS (PROD_XXX)
    // =========================
    PRODUCT_CREATE_FAILED: "PROD_001",
    PRODUCT_UPDATE_FAILED: "PROD_002",
    PRODUCT_DELETE_FAILED: "PROD_003",
    PRODUCT_MERGE_FAILED: "PROD_004",
    PRODUCT_ALREADY_EXISTS: "PROD_005",
    PRODUCT_INVALID_NAME: "PROD_006",
    PRODUCT_INVALID_SLUG: "PROD_007",
    PRODUCT_NOT_FOUND: "PROD_008",
    PRODUCT_HAS_ASSOCIATIONS: "PROD_009",

    // =========================
    // BACKUP & RESTORE (BACKUP_XXX)
    // =========================
    BACKUP_CREATE_FAILED: "BACKUP_001",
    BACKUP_RESTORE_FAILED: "BACKUP_002",
    BACKUP_INVALID_FILE: "BACKUP_003",
    BACKUP_CORRUPTED: "BACKUP_004",
    BACKUP_NO_DATA: "BACKUP_005",
    EXPORT_FAILED: "BACKUP_006",
    IMPORT_FAILED: "BACKUP_007",

    // =========================
    // AUTH & CONNECTION (AUTH_XXX, CONN_XXX)
    // =========================
    AUTH_LOGIN_FAILED: "AUTH_001",
    AUTH_REGISTER_FAILED: "AUTH_002",
    AUTH_LOGOUT_FAILED: "AUTH_003",
    AUTH_SESSION_INVALID: "AUTH_004",
    AUTH_EMAIL_NOT_CONFIRMED: "AUTH_005",
    AUTH_INVALID_CREDENTIALS: "AUTH_006",
    AUTH_WEAK_PASSWORD: "AUTH_007",
    AUTH_INVALID_EMAIL: "AUTH_008",
    CONNECTION_ERROR: "CONN_001",
    CONNECTION_TIMEOUT: "CONN_002",
    SERVER_ERROR: "CONN_003",
    SUPABASE_NOT_CONFIGURED: "CONN_004",

    // =========================
    // AI & API (AI_XXX, API_XXX)
    // =========================
    AI_NOT_CONFIGURED: "AI_001",
    AI_CONNECTION_FAILED: "AI_002",
    AI_PROCESSING_FAILED: "AI_003",
    AI_INVALID_RESPONSE: "AI_004",
    AI_RATE_LIMIT: "AI_005",
    AI_TIMEOUT: "AI_006",
    API_KEY_INVALID: "API_001",
    API_KEY_REQUIRED: "API_002",

    // =========================
    // SETTINGS (SETTINGS_XXX)
    // =========================
    SETTINGS_SAVE_FAILED: "SETTINGS_001",
    SETTINGS_CLEAR_HISTORY_FAILED: "SETTINGS_002",
    SETTINGS_CLEAR_DICTIONARY_FAILED: "SETTINGS_003",
    SETTINGS_CLEAR_PRODUCTS_FAILED: "SETTINGS_004",
    SETTINGS_SYNC_FAILED: "SETTINGS_005",
    SETTINGS_SYNC_REQUIRED: "SETTINGS_006",
    SETTINGS_TEST_FAILED: "SETTINGS_007",

    // =========================
    // STORAGE (STORAGE_XXX)
    // =========================
    STORAGE_SUPABASE_FAILED: "STORAGE_001",
    STORAGE_FALLBACK_FAILED: "STORAGE_002",
    STORAGE_QUOTA_EXCEEDED: "STORAGE_003",
    STORAGE_NOT_AVAILABLE: "STORAGE_004",
    STORAGE_READ_FAILED: "STORAGE_005",
    STORAGE_WRITE_FAILED: "STORAGE_006",
    STORAGE_DELETE_FAILED: "STORAGE_007",
    STORAGE_MIGRATION_FAILED: "STORAGE_008",

    // =========================
    // GENERIC (GEN_XXX)
    // =========================
    UNKNOWN_ERROR: "GEN_000",
    VALIDATION_ERROR: "GEN_001",
    NETWORK_ERROR: "GEN_002",
    SAVE_FAILED: "GEN_003",
    LOAD_FAILED: "GEN_004",
    DELETE_FAILED: "GEN_005",
    UPDATE_FAILED: "GEN_006",
    PROCESS_FAILED: "GEN_007",
    OPERATION_FAILED: "GEN_008",
    PERMISSION_DENIED: "GEN_009",
    NOT_FOUND: "GEN_010",
    FIELD_REQUIRED: "GEN_011",
} as const;

/**
 * Tipo para códigos de erro
 */
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Classe de erro padronizada da aplicação
 *
 * @example
 * ```typescript
 * throw new AppError(
 *   ErrorCodes.NFC_E_PARSE_FAILED,
 *   "Não foi possível processar a NFC-e",
 *   "parseNFCeSP",
 *   originalError
 * );
 * ```
 */
export class AppError extends Error {
    public readonly code: ErrorCode;
    public readonly context?: string;
    public readonly cause?: unknown;
    public readonly timestamp: string;

    constructor(
        code: ErrorCode,
        message: string,
        context?: string,
        cause?: unknown
    ) {
        super(message);
        this.name = "AppError";
        this.code = code;
        this.context = context;
        this.cause = cause;
        this.timestamp = new Date().toISOString();
    }

    /**
     * Retorna representação JSON do erro para logging
     */
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            context: this.context,
            cause: this.cause instanceof Error ? this.cause.message : String(this.cause),
            timestamp: this.timestamp,
        };
    }

    /**
     * Cria um AppError a partir de um erro genérico
     */
    static fromError(
        error: unknown,
        defaultCode: ErrorCode = ErrorCodes.UNKNOWN_ERROR,
        context?: string
    ): AppError {
        if (error instanceof AppError) {
            return error;
        }

        if (error instanceof Error) {
            return new AppError(defaultCode, error.message, context, error);
        }

        return new AppError(
            defaultCode,
            String(error ?? "Erro desconhecido"),
            context,
            error
        );
    }
}

/**
 * Type guard para verificar se é um AppError
 */
export function isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
}

/**
 * Extrai o código de erro de um AppError ou retorna código padrão
 */
export function getErrorCode(error: unknown, defaultCode: ErrorCode = ErrorCodes.UNKNOWN_ERROR): ErrorCode {
    if (error instanceof AppError) {
        return error.code;
    }
    return defaultCode;
}
