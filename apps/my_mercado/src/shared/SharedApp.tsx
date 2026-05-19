import { SharedListView } from "./components/SharedListView";
import "./shared.css";

type SharedAppProps = {
    code: string;
};

/**
 * Root component do shared client.
 * Providers mínimos: apenas CSS.
 * Sem QueryProvider, sem auth, sem stores globais.
 */
export function SharedApp({ code }: SharedAppProps) {
    return (
        <div className="shared-app">
            <SharedListView code={code} />
        </div>
    );
}
