import { HomePage } from '@/pages/HomePage';
import { CollectionPage } from '@/pages/CollectionPage';
import SplashScreen from '@/components/SplashScreen';
import { useAppStore } from '@/store/useAppStore';

function App() {
    const { currentCollectionId } = useAppStore();

    return (
        <div className="min-h-screen bg-slate-100">
            <header className="h-12 bg-slate-800 text-white flex items-center px-4 text-sm">
                Collection Viewer
            </header>
            {currentCollectionId === null ? <HomePage /> : <CollectionPage />}
            {/* Temporarily visible to preview the splash. Lifecycle will be wired later. */}
            <SplashScreen visible={false} />
        </div>
    );
}

export default App;
