/**
 * Tipos para funcionalidades de Scanner
 *
 * @fileoverview Este arquivo contém tipos relacionados ao scanner de NFC-e
 */

import type { Receipt, ReceiptItem } from "./domain";

// =========================
// SCREEN STATES
// =========================

/**
 * Estados possíveis da tela do scanner
 */
export type ScannerScreen = "idle" | "scanning" | "loading" | "result" | "manual";

// =========================
// LOADING STEPS
// =========================

export type LoadingStep =
  | "fetching"
  | "parsing"
  | "verifying_dict"
  | "calling_ai"
  | "saving_vips"
  | "saving";

export const LOADING_STEP_LABELS: Record<LoadingStep, string> = {
  fetching: "Buscando dados da nota fiscal...",
  parsing: "Analisando itens da nota...",
  verifying_dict: "Verificando dicionário de produtos...",
  calling_ai: "Processando nomes com Inteligência Artificial...",
  saving_vips: "Atualizando base de produtos canônicos...",
  saving: "Salvando nota...",
};

// =========================
// SAVE RESPONSE TYPES
// =========================

/**
 * Resposta ao salvar um receipt
 */
export type SaveReceiptResponse =
  | { duplicate: true; existingReceipt: Receipt; contentMatchLevel?: "exact" | "probable" }
  | { success: true; receipt: Receipt }
  | { success: false; error: unknown };

// =========================
// MANUAL RECEIPT TYPES
// =========================

/**
 * Dados de um receipt manual
 */
export interface ManualReceiptData {
  establishment: string;
  date: string;
  items: ReceiptItem[];
}

/**
 * Input para item de receipt manual
 */
export interface ManualReceiptItemInput {
  name: string;
  qty: string;
  unitPrice: string;
  totalPrice: string;
}

// =========================
// SCANNER CONTROLS
// =========================

/**
 * Controles do scanner (zoom, torch)
 */
export interface ScannerControls {
  zoom: number;
  zoomSupported: boolean;
  torch: boolean;
  torchSupported: boolean;
}

// =========================
// COMPONENT PROPS
// =========================

/**
 * Props para o componente ManualReceiptForm
 */
export interface EstablishmentOption {
  value: string;
  label: string;
}

export interface ManualReceiptFormProps {
  manualData: ManualReceiptData;
  setManualData: (
    data: ManualReceiptData | ((prev: ManualReceiptData) => ManualReceiptData)
  ) => void;
  manualItem: ManualReceiptItemInput;
  setManualItem: (
    item: ManualReceiptItemInput | ((prev: ManualReceiptItemInput) => ManualReceiptItemInput)
  ) => void;
  onAddManualItem: () => void;
  onRemoveManualItem: (index: number) => void;
  onSaveManualReceipt: () => void;
  onCancel: () => void;
  calculateReceiptTotal: (items: ReceiptItem[]) => number;
  productSuggestions?: string[];
  establishmentOptions?: EstablishmentOption[];
}

/**
 * Propriedades para o componente InitialScannerScreen
 *
 * A tela de entrada está organizada em dois grupos de importação:
 *  - "qr": leitura do QR Code (câmera, tirar foto, carregar imagem, carregar link).
 *  - "ia": extração completa da nota por IA (enviar texto, enviar imagem).
 *
 * Cada grupo expõe os handlers correspondentes; o componente cuida internamente
 * de qual método do grupo está ativo (menu inferior persistente).
 */
export type ImportGroup = "qr" | "ia";

export type QrMethod = "camera" | "photo" | "gallery" | "link";
export type IaMethod = "text" | "image";
export type ImportMethod = QrMethod | IaMethod;

export interface InitialScannerScreenProps {
  onStartCamera: () => void;
  onStopCamera?: () => void;
  torch?: boolean;
  torchSupported?: boolean;
  applyTorch?: (on: boolean) => void;
  isNative?: boolean;
  nativeVideoRef?: React.RefObject<HTMLVideoElement | null>;
  /** Decodifica QR Code de uma foto tirada na hora (capture=environment). */
  onQrPhoto: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Decodifica QR Code de uma imagem selecionada na galeria. */
  onQrGallery: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Processa o link da NFC-e informado pelo usuário. */
  onUrlSubmit: (url: string) => void;
  /** Extrai dados da nota a partir de texto colado. */
  onIaText: (text: string) => void;
  /** Extrai dados completos da nota a partir de uma imagem (foto ou galeria). */
  onIaImage: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onManualMode: () => void;
  isLoading: boolean;
  isScanning: boolean;
  error: string | null;
  /** Notifica quando o usuário entra ou sai da tela com as entradas para escanear */
  onEntryActiveChange?: (active: boolean) => void;
}

/**
 * Props para o componente ScannerView
 */
export interface ScannerViewProps {
  isScanning: boolean;
  torchSupported: boolean;
  torch: boolean;
  applyTorch: (value: boolean) => void;
  isNative?: boolean;
  nativeVideoRef?: React.RefObject<HTMLVideoElement | null>;
}

/**
 * Props para o componente ReceiptResult
 */
export interface ReceiptResultProps {
  currentReceipt: Receipt;
  onReset: () => void;
  onSave: () => void;
  isSaving?: boolean;
  calculateReceiptTotal: (items: ReceiptItem[]) => number;
}

/**
 * Props para o componente DuplicateModal
 */
export interface DuplicateModalProps {
  duplicateReceipt: Receipt;
  onCancel: () => void;
  onForceSave: () => void;
  /**
   * Grau de confiança da correspondência. "exact" (padrão) mantém o texto
   * atual; "probable" indica correspondência por conteúdo entre fontes e exibe
   * aviso de que pode não ser a mesma compra. Opcional — QR/texto/manual não
   * passam este campo e preservam o comportamento anterior.
   */
  matchLevel?: "exact" | "probable";
}

/**
 * Props para o componente LoadingScreen
 */
export interface LoadingScreenProps {
  message?: string;
  step?: LoadingStep | null;
}

/**
 * Props para o componente ScanningScreen
 */
export interface ScanningScreenProps {
  onStopCamera: () => void;
  torch: boolean;
  torchSupported: boolean;
  applyTorch: (on: boolean) => void;
  isNative?: boolean;
  nativeVideoRef?: React.RefObject<HTMLVideoElement | null>;
}

// =========================
// STYLES
// =========================

/**
 * Estilos CSS para componentes do scanner
 */
export interface ScannerStyles {
  header: React.CSSProperties;
  title: React.CSSProperties;
  iconButton: React.CSSProperties;
  inputGroup: React.CSSProperties;
  sectionTitle: React.CSSProperties;
  grid3: React.CSSProperties;
  actionButton: React.CSSProperties;
  primaryButton: React.CSSProperties;
  cameraControl: React.CSSProperties;
}
