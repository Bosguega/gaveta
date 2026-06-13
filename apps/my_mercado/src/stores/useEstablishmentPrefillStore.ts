import { create } from "zustand";

type EstablishmentPrefillState = {
    nomeNota: string | null;
    setNomeNota: (value: string | null) => void;
    clear: () => void;
};

export const useEstablishmentPrefillStore = create<EstablishmentPrefillState>((set) => ({
    nomeNota: null,
    setNomeNota: (value) => set({ nomeNota: value }),
    clear: () => set({ nomeNota: null }),
}));