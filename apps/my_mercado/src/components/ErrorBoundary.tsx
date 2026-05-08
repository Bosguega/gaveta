import { Component, type ErrorInfo, type ReactNode } from "react";
import { logger } from "../utils/logger";
import { notify } from "../utils/notifications";
import { ErrorCodes } from "../utils/errorCodes";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary global para capturar erros em toda a aplicação.
 * Mostra UI de fallback amigável e notifica o usuário.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error(
      "ErrorBoundary",
      error.message,
      { error, componentStack: errorInfo.componentStack },
      ErrorCodes.UNKNOWN_ERROR
    );

    notify.error("Ops! Algo deu errado. Tente recarregar a página.");

    // Em desenvolvimento, log mais detalhado
    if (import.meta.env.DEV) {
      logger.debug("ErrorBoundary", "Detalhes do erro", {
        error: error.toString(),
        componentStack: errorInfo.componentStack,
      });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleClearData = () => {
    // Limpar localStorage e recarregar
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="app-container"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "100vh",
            padding: "1.5rem",
          }}
        >
          <div
            className="glass-card"
            style={{ maxWidth: "500px", width: "100%", textAlign: "center" }}
          >
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.5rem",
              }}
            >
              <span style={{ fontSize: "32px" }}>😕</span>
            </div>

            <h2 style={{ color: "#fff", marginBottom: "0.75rem" }}>
              Ops! Algo deu errado
            </h2>

            <p style={{ color: "#94a3b8", lineHeight: "1.6", marginBottom: "1.5rem" }}>
              Encontramos um erro inesperado. Isso pode acontecer devido a:
            </p>

            <ul
              style={{
                textAlign: "left",
                color: "#94a3b8",
                lineHeight: "1.8",
                marginBottom: "1.5rem",
                paddingLeft: "1.25rem",
              }}
            >
              <li>Problemas de conexão com o servidor</li>
              <li>Dados corrompidos no cache</li>
              <li>Uma atualização recente do app</li>
            </ul>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <button
                className="btn btn-success"
                onClick={this.handleRetry}
                style={{ width: "100%", padding: "0.875rem" }}
              >
                🔄 Recarregar Página
              </button>

              <button
                className="btn"
                onClick={this.handleClearData}
                style={{
                  width: "100%",
                  padding: "0.875rem",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#f87171",
                }}
              >
                🗑️ Limpar Dados e Recarregar
              </button>
            </div>

            {this.state.error && import.meta.env.DEV && (
              <details
                style={{
                  marginTop: "1.5rem",
                  textAlign: "left",
                  fontSize: "0.85rem",
                }}
              >
                <summary
                  style={{
                    color: "#64748b",
                    cursor: "pointer",
                    marginBottom: "0.5rem",
                  }}
                >
                  Detalhes do erro (apenas dev)
                </summary>
                <pre
                  style={{
                    background: "rgba(0, 0, 0, 0.3)",
                    padding: "1rem",
                    borderRadius: "0.5rem",
                    overflow: "auto",
                    fontSize: "0.75rem",
                    color: "#f87171",
                  }}
                >
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
