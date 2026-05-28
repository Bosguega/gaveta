import { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { notify } from './utils/notifications'
import { logger } from './utils/logger'
import { isSupabaseConfigured } from './services/supabaseClient'
import { useApiKey } from './hooks/useApiKey'
import { useSupabaseSession } from './hooks/useSupabaseSession'
import { useDeviceUI } from './hooks/useDeviceUI'
import ApiKeyModal from './components/ApiKeyModal'
import { PerformancePanel } from './components/PerformancePanel'
import { PWAUpdateNotification } from './components/PWAUpdateNotification'
import Login from './components/Login'
import { useReceiptsSessionStore } from './stores/useReceiptsSessionStore'
import { useScannerStore } from './stores/useScannerStore'
import { useUiStore } from './stores/useUiStore'
import { useShoppingListStore } from './stores/useShoppingListStore'
import { useAllReceiptsQuery } from './hooks/queries/useReceiptsQuery'
import { isShoppingListCloudSyncEnabled } from './utils/shoppingListCloudSync'
import { MobileLayout } from './layouts/MobileLayout'
import { DesktopLayout } from './layouts/DesktopLayout'
import { logPWADebugInfo } from './utils/pwaDebug'
import { debugDatabaseConnection } from './utils/dbDebug'
import type { AppTab } from './types/ui'
import './index.css'

function App() {
  const { sessionUser, setSessionUser, authLoading } = useSupabaseSession()
  const { mode } = useDeviceUI()

  const setSessionUserId = useReceiptsSessionStore((state) => state.setSessionUserId)
  const setError = useReceiptsSessionStore((state) => state.setError)
  const resetScannerState = useScannerStore((state) => state.resetScannerState)

  const tab = useUiStore((state) => state.tab)
  const setTab = useUiStore((state) => state.setTab)

  const { error: receiptsError, refetch } = useAllReceiptsQuery(!!sessionUser)

  // ── Sincronização de sessão ──
  useEffect(() => {
    setSessionUserId(sessionUser?.id ?? null)
    if (!sessionUser) {
      resetScannerState()
    }
  }, [resetScannerState, sessionUser, setSessionUserId])

  // ── Sincronização de dados ao logar ──
  useEffect(() => {
    if (sessionUser) {
      const timer = setTimeout(async () => {
        try {
          const { syncLocalStorageWithSupabase } = await import('./services/syncService')
          const result = await syncLocalStorageWithSupabase()
          const shouldSyncLists = isShoppingListCloudSyncEnabled()

          if (result.synced > 0) {
            notify.success(`${result.synced} nota(s) sincronizada(s) com a nuvem!`)
          }

          if (shouldSyncLists && sessionUser?.id) {
            const { syncShoppingListsWithCloud } = await import(
              './services/shoppingListCloudSyncService'
            )
            const shoppingSync = await syncShoppingListsWithCloud(sessionUser.id)

            if (shoppingSync.status === 'pulled') {
              notify.success('Listas de compras atualizadas com dados da nuvem.')
            } else if (shoppingSync.status === 'pushed') {
              notify.success('Listas de compras enviadas para a nuvem.')
            } else if (shoppingSync.status === 'skipped' && import.meta.env.DEV) {
              logger.warn('App', 'Sincronizacao de listas ignorada', shoppingSync.reason)
            }
          }

          await refetch()
        } catch (error) {
          console.warn('Erro ao sincronizar dados locais:', error)
        }
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [sessionUser, refetch])

  // ── Autosync de listas de compras ──
  useEffect(() => {
    if (!sessionUser?.id) return

    let disposed = false
    let syncTimer: ReturnType<typeof setTimeout> | null = null
    let syncInFlight = false
    let syncPending = false

    const runSync = async () => {
      if (disposed || !sessionUser?.id) return
      if (!isShoppingListCloudSyncEnabled()) return

      if (syncInFlight) {
        syncPending = true
        return
      }

      syncInFlight = true
      try {
        const { syncShoppingListsWithCloud } = await import(
          './services/shoppingListCloudSyncService'
        )
        await syncShoppingListsWithCloud(sessionUser.id)
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Falha no autosync de listas:', error)
        }
      } finally {
        syncInFlight = false
        if (syncPending && !disposed) {
          syncPending = false
          if (syncTimer) clearTimeout(syncTimer)
          syncTimer = setTimeout(() => { void runSync() }, 800)
        }
      }
    }

    let previousUpdatedAt: string | null =
      useShoppingListStore.getState().dataByUser[sessionUser.id]?.updatedAt ?? null

    const unsubscribe = useShoppingListStore.subscribe((state) => {
      const currentUpdatedAt = state.dataByUser[sessionUser.id]?.updatedAt ?? null
      if (currentUpdatedAt && currentUpdatedAt !== previousUpdatedAt) {
        previousUpdatedAt = currentUpdatedAt
        if (isShoppingListCloudSyncEnabled()) {
          if (syncTimer) clearTimeout(syncTimer)
          syncTimer = setTimeout(() => { void runSync() }, 2500)
        }
      }
    })

    return () => {
      disposed = true
      if (syncTimer) clearTimeout(syncTimer)
      unsubscribe()
    }
  }, [sessionUser])

  // ── Erro de receipts ──
  useEffect(() => {
    if (receiptsError) {
      setError(receiptsError)
      const isAuthError =
        receiptsError.message?.includes('autenticado') ||
        receiptsError.message?.includes('Unauthorized') ||
        receiptsError.message?.includes('401')

      if (!isAuthError) {
        notify.error('Erro ao sincronizar dados com o servidor. Exibindo dados locais.')
        if (import.meta.env.DEV) {
          debugDatabaseConnection()
        }
      }
    } else {
      setError(null)
    }
  }, [receiptsError, setError])

  // ── AI Config / PWA Debug ──
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const aiConfig = useApiKey()
  const { apiKey, hasAiConfig, persistApiKey, setPersistApiKey } = aiConfig

  useEffect(() => {
    if (!hasAiConfig) {
      setShowApiKeyModal(true)
    }
    if (import.meta.env.DEV) {
      logPWADebugInfo()
    }
  }, [hasAiConfig])

  const handleSaveAiConfig = async () => setShowApiKeyModal(false)
  const handleChangeTab = (nextTab: AppTab) => setTab(nextTab)

  // ── Telas de loading / erro / login ──
  if (!isSupabaseConfigured) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '1.5rem' }}>
        <div className="glass-card" style={{ maxWidth: '720px', width: '100%' }}>
          <h2 style={{ color: '#fff', marginBottom: '0.75rem' }}>Configuração necessária</h2>
          <p style={{ color: '#94a3b8', lineHeight: '1.6', marginBottom: '1rem' }}>
            Este deploy não tem o Supabase configurado. Para publicar no GitHub Pages, defina as variáveis
            <strong style={{ color: '#e2e8f0' }}> VITE_SUPABASE_URL</strong> e
            <strong style={{ color: '#e2e8f0' }}> VITE_SUPABASE_ANON_KEY</strong> como <strong style={{ color: '#e2e8f0' }}>secrets</strong> do repositório.
          </p>
          <div style={{ color: '#94a3b8', lineHeight: '1.6' }}>
            <p style={{ marginBottom: '0.5rem' }}><strong style={{ color: '#e2e8f0' }}>Passo a passo:</strong></p>
            <ol style={{ paddingLeft: '1.25rem', margin: 0 }}>
              <li>GitHub → Settings → Secrets and variables → Actions → New repository secret</li>
              <li>Crie <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code></li>
              <li>Vá em Actions e aguarde o workflow "Deploy to GitHub Pages" rodar novamente</li>
              <li>Depois, limpe o cache do site (Application → Clear storage) se ainda ficar em branco</li>
            </ol>
          </div>
        </div>
      </div>
    )
  }

  if (authLoading) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <h2 style={{ color: '#fff' }}>Carregando...</h2>
      </div>
    )
  }

  if (!sessionUser) {
    return <Login setSessionUser={setSessionUser} />
  }

  // ── App principal ──
  const isDesktop = mode === 'desktop' || mode === 'tablet'

  return (
    <>
      {isDesktop ? (
        <DesktopLayout
          tab={tab}
          onTabChange={handleChangeTab}
          onOpenAiConfig={() => setShowApiKeyModal(true)}
        />
      ) : (
        <MobileLayout
          tab={tab}
          onTabChange={handleChangeTab}
          onOpenAiConfig={() => setShowApiKeyModal(true)}
        />
      )}

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(15, 23, 42, 0.95)',
            color: '#fff',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(8px)',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />

      <PWAUpdateNotification />

      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        aiConfig={aiConfig}
        currentKey={apiKey ?? undefined}
        onSave={handleSaveAiConfig}
        persistKey={persistApiKey}
        onPersistChange={setPersistApiKey}
      />

      <PerformancePanel />
    </>
  )
}

export default App