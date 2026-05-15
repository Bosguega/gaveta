import { useEffect, useState } from "react";

const SHARED_PATH_PREFIX = "/s/";

export type SharedRouteState = {
    isSharedRoute: boolean;
    sharedCode: string | null;
};

/**
 * Hook que detecta se o app foi aberto com a rota /s/:code
 * e retorna o código para renderizar a SharedListView.
 *
 * Também detecta os params legados ?code= e ?data= para compatibilidade.
 */
export function useSharedRouteDetection(): SharedRouteState {
    const [state, setState] = useState<SharedRouteState>({
        isSharedRoute: false,
        sharedCode: null,
    });

    useEffect(() => {
        // Detecta /s/:code na URL path
        const pathname = window.location.pathname.replace(/\/$/, "");
        if (pathname.startsWith(SHARED_PATH_PREFIX)) {
            const code = pathname.slice(SHARED_PATH_PREFIX.length).trim();
            if (code) {
                setState({ isSharedRoute: true, sharedCode: code.toUpperCase() });
                return;
            }
        }

        // Fallback: detecta ?code= na query string (para links gerados anteriormente)
        const params = new URLSearchParams(window.location.search);
        const queryCode = params.get("code");
        if (queryCode) {
            setState({ isSharedRoute: true, sharedCode: queryCode.trim().toUpperCase() });

            // Limpa a query string e move para /s/code
            const url = new URL(window.location.href);
            url.searchParams.delete("code");
            url.pathname = `${pathname}/s/${queryCode.trim().toUpperCase()}`;
            window.history.replaceState({}, "", url.toString());
            return;
        }

        // Sem rota compartilhada
        setState({ isSharedRoute: false, sharedCode: null });
    }, []);

    return state;
}