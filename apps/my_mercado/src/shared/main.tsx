import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SharedApp } from "./SharedApp";

/**
 * Entry point do shared client.
 * Monta um React root independente, sem providers do app principal.
 * Chamado por src/main.tsx quando detecta rota /s/:code.
 */
export function mountSharedApp(container: HTMLElement, code: string) {
    const root = createRoot(container);
    root.render(
        <StrictMode>
            <SharedApp code={code} />
        </StrictMode>,
    );
}
