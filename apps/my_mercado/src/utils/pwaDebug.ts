/**
 * PWA Debug Helper
 * Ajuda a diagnosticar problemas de fetch e service worker
 */

import { logger } from './logger';

interface DebugInfo {
  userAgent: string;
  isPWA: boolean;
  isOnline: boolean;
  serviceWorkerStatus: string;
  cacheStatus: string;
  supabaseUrl?: string;
  errors: string[];
}

export async function getPWADebugInfo(): Promise<DebugInfo> {
  const debug: DebugInfo = {
    userAgent: navigator.userAgent,
    isPWA: window.matchMedia('(display-mode: standalone)').matches,
    isOnline: navigator.onLine,
    serviceWorkerStatus: 'checking',
    cacheStatus: 'checking',
    errors: []
  };

  // Verificar service worker
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        debug.serviceWorkerStatus = 'active';
        debug.cacheStatus = 'active';
      } else {
        debug.serviceWorkerStatus = 'not_registered';
        debug.cacheStatus = 'not_registered';
      }
    } catch (error) {
      debug.serviceWorkerStatus = 'error';
      debug.errors.push(`Service Worker error: ${error}`);
    }
  } else {
    debug.serviceWorkerStatus = 'not_supported';
    debug.errors.push('Service Worker not supported');
  }

  // Verificar variáveis de ambiente
  try {
    debug.supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!debug.supabaseUrl || debug.supabaseUrl === 'COLE_SUA_URL_AQUI') {
      debug.errors.push('Supabase URL não configurada');
    }
  } catch (error) {
    debug.errors.push(`Erro ao ler variáveis: ${error}`);
  }

  return debug;
}

export function logPWADebugInfo() {
  getPWADebugInfo().then(debug => {
    logger.info('PWA', '🔍 PWA Debug Info');
    logger.info('PWA', 'User Agent:', debug.userAgent);
    logger.info('PWA', 'É PWA:', debug.isPWA);
    logger.info('PWA', 'Online:', debug.isOnline);
    logger.info('PWA', 'Service Worker:', debug.serviceWorkerStatus);
    logger.info('PWA', 'Cache:', debug.cacheStatus);
    logger.info('PWA', 'Supabase URL:', debug.supabaseUrl);

    if (debug.errors.length > 0) {
      logger.error('PWA', 'Erros encontrados:', debug.errors);
    }
  });
}

export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey || supabaseUrl === 'COLE_SUA_URL_AQUI') {
      logger.error('PWA', '❌ Supabase não configurado');
      return false;
    }

    const testUrl = `${supabaseUrl}/rest/v1/`;
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Content-Type': 'application/json'
      }
    });

    logger.info('PWA', '✅ Teste de conexão Supabase:', response.status);
    return response.ok;
  } catch (error) {
    logger.error('PWA', '❌ Erro no teste de conexão:', error);
    return false;
  }
}

// Adicionar diagnóstico automático em desenvolvimento
if (import.meta.env.DEV) {
  window.addEventListener('load', () => {
    logPWADebugInfo();
    testSupabaseConnection();
  });
}
