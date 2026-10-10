import { useCallback, useMemo, useRef, useState } from "react";
import { Camera, Image as ImageIcon, Loader2, RefreshCw, X, CheckCircle, AlertTriangle } from "lucide-react";
import { formatBRL, parseBRL } from "../utils/currency";
import { formatQuantity } from "../utils/format";
import { notify } from "../utils/notifications";
import { useUpdateItemPaidPrice } from "../hooks/queries/useUpdateItemPaidPrice";
import { analyzeDiscountsFromImage, type DiscountSuggestion } from "../services/discountImageAnalyzer";
import type { ReceiptItem } from "../types/domain";

type ModalStep = "choose" | "analyzing" | "review" | "error";

interface ReviewRow {
    itemIndex: number;
    item: ReceiptItem;
    paidPrice: string;
    selected: boolean;
}

type DiscountFromPhotoModalProps = {
    isOpen: boolean;
    items: ReceiptItem[];
    onClose: () => void;
};

/**
 * Modal para conferir descontos pendentes de uma nota por foto, usando IA.
 *
 * Reaproveita a análise de imagem do app (Gemini) e aplica os descontos via o
 * mesmo caminho da edição manual (useUpdateItemPaidPrice -> paid_price). Não
 * cria nota nem altera identificador/link SEFAZ. Se a análise falhar ou for
 * ambígua, preserva os dados e permite nova tentativa.
 */
export function DiscountFromPhotoModal({ isOpen, items, onClose }: DiscountFromPhotoModalProps) {
    const [step, setStep] = useState<ModalStep>("choose");
    const [confidence, setConfidence] = useState<"alta" | "media" | "baixa" | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [rows, setRows] = useState<ReviewRow[]>([]);
    const photoInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const updatePaidPrice = useUpdateItemPaidPrice();

    const updatableItems = useMemo(
        () => items.filter((item) => !!item.id),
        [items],
    );

    const reset = useCallback(() => {
        setStep("choose");
        setConfidence(null);
        setErrorMessage(null);
        setRows([]);
        if (photoInputRef.current) photoInputRef.current.value = "";
        if (galleryInputRef.current) galleryInputRef.current.value = "";
    }, []);

    const handleClose = useCallback(() => {
        reset();
        onClose();
    }, [reset, onClose]);

    const handleAnalyze = useCallback(
        async (file: File) => {
            if (!file) return;
            setStep("analyzing");
            setErrorMessage(null);
            try {
                const result = await analyzeDiscountsFromImage(file, items);
                setConfidence(result.confidence);

                const reviewRows: ReviewRow[] = result.suggestions
                    .filter((s: DiscountSuggestion) => !!items[s.itemIndex]?.id)
                    .map((s) => ({
                        itemIndex: s.itemIndex,
                        item: items[s.itemIndex],
                        paidPrice: formatBRL(s.paidPrice),
                        selected: true,
                    }));

                setRows(reviewRows);
                setStep("review");
            } catch (err) {
                const message = err instanceof Error ? err.message : "Falha ao analisar a imagem.";
                setErrorMessage(message);
                setStep("error");
            }
        },
        [items],
    );

    const handleFileChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (file) void handleAnalyze(file);
        },
        [handleAnalyze],
    );

    const toggleRow = useCallback((index: number) => {
        setRows((prev) =>
            prev.map((row, i) => (i === index ? { ...row, selected: !row.selected } : row)),
        );
    }, []);

    const editRowPrice = useCallback((index: number, value: string) => {
        setRows((prev) =>
            prev.map((row, i) => (i === index ? { ...row, paidPrice: value } : row)),
        );
    }, []);

    const selectedCount = rows.filter((r) => r.selected).length;

    const handleApply = useCallback(() => {
        const toApply = rows.filter((r) => r.selected && r.item.id);
        if (toApply.length === 0) return;

        for (const row of toApply) {
            const parsed = parseBRL(row.paidPrice);
            if (Number.isFinite(parsed) && parsed >= 0 && parsed < row.item.price) {
                updatePaidPrice.mutate({ itemId: row.item.id as string, paidPrice: parsed });
            }
        }

        notify.success(`${toApply.length} desconto(s) aplicado(s)!`);
        handleClose();
    }, [rows, updatePaidPrice, handleClose]);

    if (!isOpen) return null;

    return (
        <div className="duplicate-modal-overlay z-[4600]" onClick={handleClose}>
            <div
                className="glass-card duplicate-modal-card"
                style={{ maxWidth: "480px" }}
                onClick={(event) => event.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                        <h3 className="text-white text-lg font-semibold mb-1">Conferir descontos pela foto</h3>
                        <p className="text-slate-500 text-xs">
                            Fotografe a parte da nota com os itens e preços para identificar os descontos.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 inline-flex items-center justify-center flex-shrink-0"
                        aria-label="Fechar"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Escolher imagem */}
                {step === "choose" && (
                    <div>
                        {updatableItems.length === 0 ? (
                            <p className="text-slate-400 text-sm">
                                Esta nota não possui itens editáveis para aplicar descontos.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                <button
                                    type="button"
                                    className="btn btn-success w-full p-4 text-base font-semibold flex items-center justify-center gap-2"
                                    onClick={() => photoInputRef.current?.click()}
                                >
                                    <Camera size={20} />
                                    Tirar foto
                                </button>
                                <button
                                    type="button"
                                    className="btn w-full p-4 text-base font-semibold bg-white/5 border border-[var(--card-border)] text-slate-200 flex items-center justify-center gap-2"
                                    onClick={() => galleryInputRef.current?.click()}
                                >
                                    <ImageIcon size={20} />
                                    Escolher da galeria
                                </button>
                                <input
                                    ref={photoInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    aria-label="Tirar foto"
                                    onChange={handleFileChange}
                                />
                                <input
                                    ref={galleryInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    aria-label="Escolher da galeria"
                                    onChange={handleFileChange}
                                />
                                <p className="text-slate-600 text-[0.65rem] text-center">
                                    A IA vai sugerir o preço pago de cada item. Você revisa antes de aplicar.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {step === "analyzing" && (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-300">
                        <Loader2 size={32} className="animate-spin mb-3" />
                        <span>Analisando imagem com IA...</span>
                    </div>
                )}

                {step === "error" && (
                    <div className="space-y-4">
                        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg p-3 text-sm">
                            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                            <span>{errorMessage || "Não foi possível analisar a imagem."}</span>
                        </div>
                        <p className="text-slate-500 text-xs">
                            Seus dados atuais foram preservados. Você pode tentar novamente com outra foto.
                        </p>
                        <button
                            type="button"
                            className="btn w-full p-3 bg-white/5 border border-[var(--card-border)] flex items-center justify-center gap-2"
                            onClick={reset}
                        >
                            <RefreshCw size={16} />
                            Tentar novamente
                        </button>
                    </div>
                )}

                {/* Revisão das sugestões */}
                {step === "review" && (
                    <div className="space-y-4">
                        {confidence && confidence !== "alta" && (
                            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-lg p-3 text-xs">
                                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                                <span>
                                    Confiança {confidence === "media" ? "média" : "baixa"}: revise cada sugestão
                                    com atenção antes de aplicar.
                                </span>
                            </div>
                        )}

                        {rows.length === 0 ? (
                            <div className="text-center py-6">
                                <p className="text-slate-400 text-sm mb-4">
                                    Nenhum desconto foi identificado com segurança nesta imagem.
                                </p>
                                <button
                                    type="button"
                                    className="btn w-full p-3 bg-white/5 border border-[var(--card-border)] flex items-center justify-center gap-2"
                                    onClick={reset}
                                >
                                    <RefreshCw size={16} />
                                    Tentar novamente
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="max-h-[300px] overflow-y-auto space-y-2">
                                    {rows.map((row, index) => {
                                        const name = row.item.normalized_name || row.item.name;
                                        const unit = row.item.unit || "un";
                                        const fullUnit = row.item.price;
                                        return (
                                            <div
                                                key={row.itemIndex}
                                                className="item-row py-2.5 px-3 bg-white/[0.03] flex items-center gap-3"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={row.selected}
                                                    onChange={() => toggleRow(index)}
                                                    className="w-4 h-4 flex-shrink-0 cursor-pointer"
                                                    aria-label={`Aplicar desconto em ${name}`}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm text-slate-200 truncate">{name}</div>
                                                    <div className="text-xs text-slate-500">
                                                        {formatQuantity(row.item.quantity)} x R$ {formatBRL(fullUnit)}/{unit}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end flex-shrink-0">
                                                    <span className="text-slate-500 line-through text-[0.7rem]">
                                                        R$ {formatBRL(fullUnit)}
                                                    </span>
                                                    <input
                                                        className="search-input text-right text-sm py-1 px-2 w-24"
                                                        inputMode="decimal"
                                                        value={row.paidPrice}
                                                        onChange={(e) => editRowPrice(index, e.target.value)}
                                                        aria-label={`Preço pago de ${name}`}
                                                    />
                                                    {(() => {
                                                        const parsedPaid = parseBRL(row.paidPrice);
                                                        const paidLineTotal =
                                                            (Number.isFinite(parsedPaid) ? parsedPaid : 0) *
                                                            (row.item.quantity || 1);
                                                        return (
                                                            <div className="text-[0.7rem] text-slate-500 mt-1 text-right">
                                                                = R$ {formatBRL(paidLineTotal)}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        className="btn bg-white/5 border border-[var(--card-border)] flex items-center justify-center gap-2"
                                        onClick={reset}
                                    >
                                        <RefreshCw size={16} />
                                        Nova foto
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-success flex items-center justify-center gap-2"
                                        onClick={handleApply}
                                        disabled={selectedCount === 0 || updatePaidPrice.isPending}
                                    >
                                        {updatePaidPrice.isPending ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <CheckCircle size={16} />
                                        )}
                                        Aplicar ({selectedCount})
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}