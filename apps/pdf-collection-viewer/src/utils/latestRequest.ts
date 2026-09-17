export function createLatestRequest() {
    let version = 0;
    return {
        begin(isActive: () => boolean = () => true) {
            const request = ++version;
            return () => request === version && isActive();
        },
        invalidate() {
            version++;
        },
    };
}
