const getApiUrl = () => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    // Default to same-origin so Vite can proxy `/api` to the backend in dev (avoids HTTPS mixed-content).
    return '';
};

export const API_URL = getApiUrl();
