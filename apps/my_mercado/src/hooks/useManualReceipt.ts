import { useCallback } from 'react';
import { notify } from '../utils/notifications';
import { logger } from '../utils/logger';
import { useScannerStore } from '../stores/useScannerStore';
import { validateManualReceiptForm } from '../utils/validation';
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
    const qty = parseFloat(String(manualItem.qty || '1').replace(',', '.')) || 1;

    // Validação de quantidade
    if (qty <= 0) {
      notify.warning('Quantidade deve ser maior que zero');
      return;
    }

    const unitPrice = parseFloat(String(manualItem.unitPrice || '0').replace(',', '.'));
    const totalPrice = parseFloat(String(manualItem.totalPrice || '0').replace(',', '.'));

    // Validação: precisa de nome e pelo menos um dos preços
    const name = manualItem.name?.trim();
    if (!name) {
      notify.warning('Nome do produto é obrigatório');
      return;
    }
    if (!unitPrice && !totalPrice) {
      notify.warning('Informe o preço unitário ou o preço total');
      return;
    }

    // Avisa sobre conflito se ambos foram preenchidos com valores inconsistentes
    const expectedTotal = unitPrice * qty;
    if (unitPrice > 0 && totalPrice > 0) {
      const diff = Math.abs(totalPrice - expectedTotal);
      if (diff > 0.02) {
        notify.warning(
          `Preços conflitantes (unitário: R$ ${unitPrice.toFixed(2)}, total: R$ ${totalPrice.toFixed(2)}) — usando o total informado.`
        );
      }
    }

    const finalTotal = totalPrice > 0 ? totalPrice : expectedTotal;
    const finalUnitPrice = unitPrice > 0 ? unitPrice : finalTotal / qty;

    const newItem = {
      name,
      quantity: qty,
      price: finalUnitPrice,
      paid_price: finalUnitPrice,
      total: finalTotal,
    };

    // Atualização funcional para evitar stale state
    setManualData(prev => ({ ...prev, items: [newItem, ...prev.items] }));
    setManualItem({ name: '', qty: '1', unitPrice: '', totalPrice: '' });
    notify.itemAdded();
  }, [manualItem, setManualData, setManualItem]);

  const handleRemoveManualItem = useCallback(
    (index: number) => {
      setManualData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
      notify.itemRemoved();
    },
    [setManualData],
  );

  const handleSaveManualReceipt = useCallback(async () => {
    // Bloqueia imediatamente para evitar múltiplos cliques
    setLoading(true);

    try {
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
