import { useCallback } from 'react';
import { notify } from '../utils/notifications';
import { logger } from '../utils/logger';
import { useScannerStore } from '../stores/useScannerStore';
import { validateManualReceiptForm, validateManualItem } from '../utils/validation';
import { processItemsPipeline } from '../services/productService';
import { generateManualReceiptId } from '../utils/receiptId';
import type { Receipt } from '../types/domain';

/**
 * Hook para gerenciar formulário de receipt manual
 */
export function useManualReceipt() {
  const loading = useScannerStore((state) => state.loading);
  const setLoading = useScannerStore((state) => state.setLoading);
  const manualMode = useScannerStore((state) => state.manualMode);
  const setManualMode = useScannerStore((state) => state.setManualMode);
  const manualData = useScannerStore((state) => state.manualData);
  const setManualData = useScannerStore((state) => state.setManualData);
  const manualItem = useScannerStore((state) => state.manualItem);
  const setManualItem = useScannerStore((state) => state.setManualItem);
  const setCurrentReceipt = useScannerStore((state) => state.setCurrentReceipt);

  const getDefaultManualData = useCallback((): typeof manualData => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = String(now.getFullYear());
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return {
      establishment: '',
      date: `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`,
      items: [],
    };
  }, []);

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
      paid_price: priceNum,
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

    setLoading(true);

    try {
      // 2. Passar os itens pela pipeline de normalização (dicionário + IA)
      //    igual às notas escaneadas — recebe normalized_name e category
      const rawItemsForPipeline = items.map((item, idx) => ({
        name: manualData.items[idx]?.name || item.name,
        qty: String(item.qty),
        unit: 'UN',
        unitPrice: String(item.unitPrice),
        total: String(
          (parseFloat(String(item.qty).replace(',', '.')) || 1) *
          (parseFloat(String(item.unitPrice).replace(',', '.')) || 0),
        ),
      }));

      const processedItems = await processItemsPipeline(rawItemsForPipeline);

      const manualId = generateManualReceiptId(establishment, date);

      // 3. Monta receipt completo (sem salvar ainda) e exibe no ResultScreen
      const finalReceipt: Receipt = {
        id: manualId,
        establishment: establishment.trim() || 'Compra Manual',
        date: manualData.date,
        items: processedItems.map((processed, idx) => {
          const quantity = parseFloat(String(items[idx].qty).replace(',', '.')) || 1;
          const price = parseFloat(String(items[idx].unitPrice).replace(',', '.')) || 0;
          return {
            ...processed,
            id: manualData.items[idx]?.id,
            quantity,
            price,
            paid_price: price,
            total: quantity * price,
          };
        }),
      };

      // Sai do modo manual e exibe no ResultScreen (mesmo fluxo das notas escaneadas)
      setCurrentReceipt(finalReceipt);
      setManualMode(false);
      setManualData(getDefaultManualData());

      notify.success('Nota preparada! Revise e salve.');
    } catch (err) {
      notify.errorSaving();
      logger.error('ManualReceipt', 'Erro ao processar nota manual', err);
    } finally {
      setLoading(false);
    }
  }, [
    manualData,
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
