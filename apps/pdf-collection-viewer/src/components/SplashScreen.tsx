interface SplashScreenProps {
    visible: boolean;
}

/**
 * Full-screen splash shown while the app is organizing files.
 * The lifecycle (when it opens/closes) is handled by the caller.
 */
function SplashScreen({ visible }: SplashScreenProps) {
    if (!visible) {
        return null;
    }

    return (
        <div className="splash-screen" role="status" aria-live="polite">
            <div className="splash-screen__content">
                <p className="splash-screen__message">
                    Aguarde enquanto organizamos seus arquivos
                </p>
                <div className="splash-screen__dots" aria-hidden="true">
                    <span className="splash-screen__dot" />
                    <span className="splash-screen__dot" />
                    <span className="splash-screen__dot" />
                </div>
            </div>
        </div>
    );
}

export default SplashScreen;