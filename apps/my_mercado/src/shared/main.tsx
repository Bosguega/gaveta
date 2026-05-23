import { createRoot } from "react-dom/client";
import { SharedApp } from "./SharedApp";

export function mountSharedApp(rootElement: HTMLElement, code: string) {
    const root = createRoot(rootElement);
    root.render(<SharedApp code={code} />);
}