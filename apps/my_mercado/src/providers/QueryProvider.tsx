import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Configuração do QueryClient com opções otimizadas
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Cache por 5 minutos
            staleTime: 5 * 60 * 1000,
            // Manter cache por 10 minutos
            gcTime: 10 * 60 * 1000,
            // Revalidar ao focar na janela
            refetchOnWindowFocus: true,
            // Retry automático em caso de erro
            retry: 2,
            // Não revalidar ao reconectar por padrão
            refetchOnReconnect: false,
        },
        mutations: {
            // Retry automático para mutações
            retry: 1,
        },
    },
});

interface QueryProviderProps {
    children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
