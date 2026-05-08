import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { logger } from '../utils/logger';
import type { SessionUser } from '../types/domain';

export function useSupabaseSession() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    if (import.meta.env.DEV) {
      logger.info('Auth', '🔑 Iniciando useSupabaseSession...');
    }

    if (!supabase) {
      if (import.meta.env.DEV) {
        logger.warn('Auth', '⚠️ Supabase não configurado');
      }
      setAuthLoading(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (import.meta.env.DEV) {
          logger.info('Auth', '🔑 Sessão obtida:', session ? 'COM sessão' : 'SEM sessão');
          if (session) {
            logger.info('Auth', '🔑 User ID:', session.user.id);
            logger.info('Auth', '🔑 Email:', session.user.email);
          }
        }
        setSessionUser(session?.user ?? null);
      })
      .catch((err) => {
        if (import.meta.env.DEV) {
          logger.error('Auth', '❌ Erro ao obter sessão:', err);
        }
        setSessionUser(null);
      })
      .finally(() => {
        if (import.meta.env.DEV) {
          logger.info('Auth', '🔑 Loading = false');
        }
        setAuthLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (import.meta.env.DEV) {
        logger.info('Auth', '🔄 Mudança de estado:', { event: _event, hasSession: !!session });
      }
      setSessionUser(session?.user ?? null);
    });

    return () => {
      if (import.meta.env.DEV) {
        logger.info('Auth', '🔑 Limpando subscription');
      }
      subscription.unsubscribe();
    };
  }, []);

  return { sessionUser, setSessionUser, authLoading };
}
