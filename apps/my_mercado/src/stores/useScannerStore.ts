import { create } from "zustand";
import type { Receipt } from "../types/domain";
import type { ManualReceiptData, ManualReceiptItemInput, LoadingStep } from "../types/scanner";

// ==============================
// Sub-slices
// ==============================

interface ScanSlice {
  currentReceipt: Receipt | null;
  loading: boolean;
  loadingStep: LoadingStep | null;
  scanning: boolean;
  error: string | null;
  duplicateReceipt: Receipt | null;
  isSaving: boolean;
}

interface ScanActions {
  setCurrentReceipt: (
    value: Receipt | null | ((prev: Receipt | null) => Receipt | null),
  ) => void;
  setLoading: (value: boolean) => void;
  setLoadingStep: (value: LoadingStep | null) => void;
  setScanning: (value: boolean) => void;
  setError: (value: string | null) => void;
  setDuplicateReceipt: (value: Receipt | null) => void;
  setIsSaving: (value: boolean) => void;
}

interface CameraSlice {
  zoom: number;
  zoomSupported: boolean;
  torch: boolean;
  torchSupported: boolean;
}

interface CameraActions {
  setZoom: (value: number) => void;
  setZoomSupported: (value: boolean) => void;
  setTorch: (value: boolean) => void;
  setTorchSupported: (value: boolean) => void;
}

interface ManualSlice {
  manualMode: boolean;
  manualData: ManualReceiptData;
  manualItem: ManualReceiptItemInput;
}

interface ManualActions {
  setManualMode: (value: boolean) => void;
  setManualData: (
    value:
      | ManualReceiptData
      | ((prev: ManualReceiptData) => ManualReceiptData),
  ) => void;
  setManualItem: (
    value:
      | ManualReceiptItemInput
      | ((prev: ManualReceiptItemInput) => ManualReceiptItemInput),
  ) => void;
}

interface ResetActions {
  resetScannerState: () => void;
}

// ==============================
// Estado inicial
// ==============================

const defaultManualData: ManualReceiptData = {
  establishment: "",
  date: new Date().toLocaleDateString("pt-BR"),
  items: [],
};

const defaultManualItem: ManualReceiptItemInput = {
  name: "",
  qty: "1",
  unitPrice: "",
};

const initialScanState: ScanSlice = {
  currentReceipt: null,
  loading: false,
  loadingStep: null,
  scanning: false,
  error: null,
  duplicateReceipt: null,
  isSaving: false,
};

const initialCameraState: CameraSlice = {
  zoom: 1,
  zoomSupported: false,
  torch: false,
  torchSupported: false,
};

const initialManualState: ManualSlice = {
  manualMode: false,
  manualData: defaultManualData,
  manualItem: defaultManualItem,
};

// ==============================
// Store
// ==============================

type ScannerState = ScanSlice &
  ScanActions &
  CameraSlice &
  CameraActions &
  ManualSlice &
  ManualActions &
  ResetActions;

export const useScannerStore = create<ScannerState>()((set) => ({
  // Scan Slice
  ...initialScanState,
  setCurrentReceipt: (value) =>
    set((state) => ({
      currentReceipt:
        typeof value === "function" ? value(state.currentReceipt) : value,
    })),
  setLoading: (value) => set({ loading: value }),
  setLoadingStep: (value) => set({ loadingStep: value }),
  setScanning: (value) => set({ scanning: value }),
  setError: (value) => set({ error: value }),
  setDuplicateReceipt: (value) => set({ duplicateReceipt: value }),
  setIsSaving: (value) => set({ isSaving: value }),

  // Camera Slice
  ...initialCameraState,
  setZoom: (value) => set({ zoom: value }),
  setZoomSupported: (value) => set({ zoomSupported: value }),
  setTorch: (value) => set({ torch: value }),
  setTorchSupported: (value) => set({ torchSupported: value }),

  // Manual Slice
  ...initialManualState,
  setManualMode: (value) => set({ manualMode: value }),
  setManualData: (value) =>
    set((state) => ({
      manualData: typeof value === "function" ? value(state.manualData) : value,
    })),
  setManualItem: (value) =>
    set((state) => ({
      manualItem: typeof value === "function" ? value(state.manualItem) : value,
    })),

  // Reset Action
  resetScannerState: () =>
    set({
      ...initialScanState,
      ...initialCameraState,
      manualMode: false,
      manualData: {
        establishment: "",
        date: new Date().toLocaleDateString("pt-BR"),
        items: [],
      },
      manualItem: {
        name: "",
        qty: "1",
        unitPrice: "",
      },
    }),
}));