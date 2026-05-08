/**
 * Database Debug Helper
 * Ajuda a diagnosticar problemas de sincronização com Supabase
 */

import { logger } from './logger';
import { supabase } from '../services/supabaseClient';

export async function debugDatabaseConnection() {
  logger.info('DB', '🔍 Database Debug Info');

  try {
    // 1. Verificar se Supabase está configurado
    if (!supabase) {
      logger.error('DB', '❌ Supabase não configurado');
      return false;
    }

    logger.info('DB', '✅ Supabase client configurado');

    // 2. Verificar usuário autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.error('DB', '❌ Usuário não autenticado:', authError);
      return false;
    }

    logger.info('DB', '✅ Usuário autenticado:', user.id);
    logger.info('DB', '✅ Email:', user.email);

    // 3. Testar acesso à tabela receipts
    logger.info('DB', '🔍 Testando acesso à tabela receipts...');

    const { data: receiptsData, error: receiptsError } = await supabase
      .from('receipts')
      .select('id, establishment, date, created_at')
      .eq('user_id', user.id)
      .limit(1);

    if (receiptsError) {
      logger.error('DB', '❌ Erro ao acessar receipts:', receiptsError);

      // Verificar se é erro de permissão (RLS)
      if (receiptsError.code === '42501' || receiptsError.message.includes('permission denied')) {
        logger.error('DB', '🚨 Problema de RLS (Row Level Security)');
        logger.error('DB', '   Verifique as políticas de acesso no Supabase');
      }

      return false;
    }

    logger.info('DB', '✅ Acesso à tabela receipts OK');
    logger.info('DB', '📊 Registros encontrados:', receiptsData?.length || 0);

    // 4. Testar acesso à tabela dictionary
    logger.info('DB', '🔍 Testando acesso à tabela dictionary...');

    const { data: dictData, error: dictError } = await supabase
      .from('dictionary')
      .select('key, normalized_name')
      .eq('user_id', user.id)
      .limit(1);

    if (dictError) {
      logger.error('DB', '❌ Erro ao acessar dictionary:', dictError);
      return false;
    }

    logger.info('DB', '✅ Acesso à tabela dictionary OK');
    logger.info('DB', '📊 Registros encontrados:', dictData?.length || 0);

    // 5. Testar acesso à tabela canonical_products
    logger.info('DB', '🔍 Testando acesso à tabela canonical_products...');

    const { data: cpData, error: cpError } = await supabase
      .from('canonical_products')
      .select('id, name, slug')
      .limit(1);

    if (cpError) {
      logger.error('DB', '❌ Erro ao acessar canonical_products:', cpError);
      return false;
    }

    logger.info('DB', '✅ Acesso à tabela canonical_products OK');
    logger.info('DB', '📊 Registros encontrados:', cpData?.length || 0);

    logger.info('DB', '🎉 Todas as verificações passaram!');
    return true;

  } catch (error) {
    logger.error('DB', '❌ Erro inesperado:', error);
    return false;
  }
}

export async function testReceiptInsert() {
  logger.info('DB', '🧪 Teste de Insert Receipt');

  try {
    if (!supabase) {
      logger.error('DB', '❌ Supabase não configurado');
      return false;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      logger.error('DB', '❌ Usuário não autenticado');
      return false;
    }

    // Criar receipt de teste
    const testReceipt = {
      user_id: user.id,
      establishment: 'Teste Debug',
      date: new Date().toISOString(),
      items: []
    };

    const { data, error } = await supabase
      .from('receipts')
      .insert(testReceipt)
      .select()
      .single();

    if (error) {
      logger.error('DB', '❌ Erro ao inserir receipt:', error);
      return false;
    }

    logger.info('DB', '✅ Insert OK:', data);

    // Limpar receipt de teste
    await supabase
      .from('receipts')
      .delete()
      .eq('id', data.id);

    logger.info('DB', '🧹 Teste limpo');
    return true;

  } catch (error) {
    logger.error('DB', '❌ Erro no teste:', error);
    return false;
  }
}

// Adicionar ao window para debug manual
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).debugDB = debugDatabaseConnection;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).testInsert = testReceiptInsert;
}
