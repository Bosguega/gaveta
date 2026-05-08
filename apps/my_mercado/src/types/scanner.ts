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
// SAVE RESPONSE TYPES
// =========================

/**
 * Resposta ao salvar um receipt
 */
export type SaveReceiptResponse =
  | { duplicate: true; existingReceipt: Receipt }
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
export interface ManualReceiptFormProps {
  manualData: ManualReceiptData;
  setManualData: (data: ManualReceiptData) => void;
  manualItem: ManualReceiptItemInput;
  setManualItem: (item: ManualReceiptItemInput) => void;
  onAddManualItem: () => void;
  onSaveManualReceipt: () => void;
  onCancel: () => void;
  calculateReceiptTotal: (items: ReceiptItem[]) => number;
}

/**
 * Props para o componente InitialScannerScreen
 */
export interface InitialScannerScreenProps {
  onStartCamera: () => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onManualMode: () => void;
  handleUrlSubmit: (url: string) => void;
  handleTextSubmit: (text: string) => void;
  isLoading: boolean;
  isScanning: boolean;
  error: string | null;
}

/**
 * Props para o componente ScannerView
 */
export interface ScannerViewProps {
  isScanning: boolean;
  torchSupported: boolean;
  torch: boolean;
  applyTorch: (value: boolean) => void;
}

/**
 * Props para o componente ReceiptResult
 */
export interface ReceiptResultProps {
  currentReceipt: Receipt;
  onReset: () => void;
  calculateReceiptTotal: (items: ReceiptItem[]) => number;
}

/**
 * Props para o componente DuplicateModal
 */
export interface DuplicateModalProps {
  duplicateReceipt: Receipt;
  onCancel: () => void;
  onForceSave: () => void;
}

/**
 * Props para o componente LoadingScreen
 */
export interface LoadingScreenProps {
  message?: string;
}

/**
 * Props para o componente ScanningScreen
 */
export interface ScanningScreenProps {
  onStopCamera: () => void;
  torch: boolean;
  torchSupported: boolean;
  applyTorch: (on: boolean) => void;
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
