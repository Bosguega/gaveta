import { useCallback } from 'react';
import { notify } from '../utils/notifications';
import { logger } from '../utils/logger';
import { useScannerStore } from '../stores/useScannerStore';
import { validateManualReceiptForm, validateManualItem } from '../utils/validation';
import { generateManualReceiptId } from '../utils/receiptId';
import type { Receipt } from '../types/domain';

type SaveReceiptResponse =
  | { duplicate: true; existingReceipt: Receipt }
  | { success: true; receipt: Receipt }
  | { success: false; error: unknown };

type SaveReceiptFn = (receipt: Receipt, forceReplace?: boolean) => Promise<SaveReceiptResponse>;

function isSuccessResult(
  result: SaveReceiptResponse,
): result is { success: true; receipt: Receipt } {
  return 'success' in result && result.success === true;
}

/**
 * Hook para gerenciar formulário de receipt manual
 */
export function useManualReceipt(saveReceipt: SaveReceiptFn) {
  const loading = useScannerStore((state) => state.loading);
  const setLoading = useScannerStore((state) => state.setLoading);
  const manualMode = useScannerStore((state) => state.manualMode);
  const setManualMode = useScannerStore((state) => state.setManualMode);
  const manualData = useScannerStore((state) => state.manualData);
  const setManualData = useScannerStore((state) => state.setManualData);
  const manualItem = useScannerStore((state) => state.manualItem);
  const setManualItem = useScannerStore((state) => state.setManualItem);
  const setCurrentReceipt = useScannerStore((state) => state.setCurrentReceipt);

  const getDefaultManualData = useCallback((): typeof manualData => ({
    establishment: '',
    date: new Date().toLocaleDateString('pt-BR'),
    items: [],
  }), []);

  const handleAddManualItem = useCallback(() => {
    // Validação centralizada com Zod
    const validation = validateManualItem({
      name: manualItem.name?.trim(),
      qty: String(manualItem.qty || '1'),
      unitPrice: String(manualItem.unitPrice),
    });

    if (!validation.success) {
      notify.warning(validation.error);
      return;
    }

    const { name, qty, unitPrice } = validation.data;
    const qtyNum = parseFloat(String(qty).replace(',', '.')) || 1;
    const priceNum = parseFloat(String(unitPrice).replace(',', '.'));
    const totalNum = qtyNum * priceNum;

    const newItem = {
      name: name.trim(),
      quantity: qtyNum,
      price: priceNum,
      total: totalNum,
    };

    setManualData({ ...manualData, items: [newItem, ...manualData.items] });
    setManualItem({ name: '', qty: '1', unitPrice: '' });
    notify.itemAdded();
  }, [manualItem, manualData, setManualData, setManualItem]);

  const handleRemoveManualItem = useCallback(
    (index: number) => {
      const newItems = manualData.items.filter((_, i) => i !== index);
      setManualData({ ...manualData, items: newItems });
      notify.itemRemoved();
    },
    [manualData, setManualData],
  );

  const handleSaveManualReceipt = useCallback(async () => {
    // 1. Validação com zod
    const validation = validateManualReceiptForm({
      establishment: manualData.establishment,
      date: manualData.date,
      items: manualData.items.map((item) => ({
        name: item.name,
        qty: String(item.quantity || 1),
        unitPrice: String(item.price || 0),
      })),
    });

    if (!validation.success) {
      validation.errors.forEach((error) => notify.warning(error));
      return;
    }

    const { establishment, date, items } = validation.data;

    const manualId = generateManualReceiptId(establishment, date);
    const finalData = {
      ...manualData,
      id: manualId,
      establishment: establishment.trim() || 'Compra Manual',
      items: items.map((item, idx) => {
        const quantity = parseFloat(String(item.qty).replace(',', '.')) || 1;
        const price = parseFloat(String(item.unitPrice).replace(',', '.')) || 0;
        return {
          ...manualData.items[idx],
          quantity,
          price,
          total: quantity * price,
        };
      }),
    };

    setLoading(true);
    try {
      const result = await saveReceipt(finalData);
      if (isSuccessResult(result)) {
        setCurrentReceipt(result.receipt);
        setManualMode(false);
        setManualData(getDefaultManualData());
        notify.success('Nota manual salva com sucesso!');
      }
    } catch (err) {
      notify.errorSaving();
      logger.error('ManualReceipt', 'Erro ao salvar nota manual', err);
    } finally {
      setLoading(false);
    }
  }, [
    manualData,
    saveReceipt,
    setCurrentReceipt,
    setLoading,
    setManualData,
    setManualMode,
    getDefaultManualData,
  ]);

  const handleCancelManualReceipt = useCallback(() => {
    setManualMode(false);
    setManualData(getDefaultManualData());
    notify.warning('Entrada manual cancelada');
  }, [setManualMode, setManualData, getDefaultManualData]);

  return {
    loading,
    manualMode,
    manualData,
    manualItem,
    setManualItem,
    handleAddManualItem,
    handleRemoveManualItem,
    handleSaveManualReceipt,
    handleCancelManualReceipt,
    getDefaultManualData,
  };
}
