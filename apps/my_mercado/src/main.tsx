import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

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
