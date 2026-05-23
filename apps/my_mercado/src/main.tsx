import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// ---------------------------------------------------------------------------
// Route detection — BEFORE any heavy initialization
// ---------------------------------------------------------------------------

/**
 * Detecta se a URL atual é uma rota de lista compartilhada (/s/:code).
 */
function detectSharedCode(): string | null {
  const pathname = window.location.pathname;

  // Match /s/CODE at the end of the path (works with subpath bases like /my_mercado/s/CODE)
  const pathMatch = pathname.match(/\/s\/([A-Za-z0-9]+)\/?$/);
  if (pathMatch) {
    return pathMatch[1].trim().toUpperCase();
  }

  return null;
}

const sharedCode = detectSharedCode();

if (sharedCode) {
  // ---------------------------------------------------------------------------
  // SHARED CLIENT — mini-app independente (papel de anotações)
  // Não carrega: AI config, QueryProvider, stores, auth, CSS do app principal
  // ---------------------------------------------------------------------------
  const { mountSharedApp } = await import('./shared/main');
  mountSharedApp(document.getElementById('root') as HTMLElement, sharedCode);
} else {
  // ---------------------------------------------------------------------------
  // APP PRINCIPAL — inicialização completa
  // ---------------------------------------------------------------------------
  const { Toaster } = await import('react-hot-toast');
  const { default: App } = await import('./App');
  const { QueryProvider } = await import('./providers/QueryProvider');
  const { ErrorBoundary } = await import('./components/ErrorBoundary');
  const { initializeAiConfig } = await import('@bosguega/ai-core');
  await import('./index.css');

  // Inicializa configurações de IA (carrega API key e modelo para cache sync)
  await initializeAiConfig();

  const root = createRoot(document.getElementById('root') as HTMLElement);

  root.render(
    <StrictMode>
      <ErrorBoundary>
        <QueryProvider>
          <App />
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4000,
              style: {
                background: "rgba(15, 23, 42, 0.95)",
                color: "#fff",
                borderRadius: "12px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                backdropFilter: "blur(8px)",
              },
              success: {
                iconTheme: {
                  primary: "#10b981",
                  secondary: "#fff",
                },
              },
              error: {
                iconTheme: {
                  primary: "#ef4444",
                  secondary: "#fff",
                },
              },
            }}
          />
        </QueryProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}
