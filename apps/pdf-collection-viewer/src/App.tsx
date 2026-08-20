import { HomePage } from '@/pages/HomePage';
import { CollectionPage } from '@/pages/CollectionPage';
import { useAppStore } from '@/store/useAppStore';

function App() {
    const { currentCollectionId } = useAppStore();

    return (
        <div className="min-h-screen bg-slate-100">
            <header className="h-12 bg-slate-800 text-white flex items-center px-4 text-sm">
                PDF Collection Viewer
            </header>
            {currentCollectionId === null ? <HomePage /> : <CollectionPage />}
        </div>
    );
}

export default App;