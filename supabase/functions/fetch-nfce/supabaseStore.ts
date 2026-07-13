import type { ErrorBody } from "./types.ts";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RATE_LIMIT_IP_PER_MINUTE = 45;
const RATE_LIMIT_USER_PER_MINUTE = 80;

// @ts-ignore - Supabase client is provided by Edge Function runtime
export type SupabaseClient = any;

export async function tryRateLimit(
    supabase: SupabaseClient,
    ip: string,
    userId: string | null,
): Promise<{ ok: true } | { ok: false; body: ErrorBody }> {
    const windowId = Math.floor(Date.now() / 60_000);

    // @ts-ignore
    const { data: ipAllowed, error: ipErr } = await supabase.rpc("nfce_check_and_increment_rate", {
        p_rate_key: `ip:${ip}`,
        p_window_id: windowId,
        p_limit: RATE_LIMIT_IP_PER_MINUTE,
    });

    if (ipErr) {
        console.warn(JSON.stringify({ event: "nfce_rate_ip_check_failed", message: ipErr.message }));
    } else if (ipAllowed === false) {
        return {
            ok: false,
            body: {
                success: false,
                error: "RATE_LIMITED",
                message: "Muitas consultas deste endereco. Tente novamente em ate um minuto.",
                status: 429,
            },
        };
    }

    if (userId) {
        // @ts-ignore
        const { data: userAllowed, error: userErr } = await supabase.rpc("nfce_check_and_increment_rate", {
            p_rate_key: `user:${userId}`,
            p_window_id: windowId,
            p_limit: RATE_LIMIT_USER_PER_MINUTE,
        });

        if (userErr) {
            console.warn(JSON.stringify({ event: "nfce_rate_user_check_failed", message: userErr.message }));
        } else if (userAllowed === false) {
            return {
                ok: false,
                body: {
                    success: false,
                    error: "RATE_LIMITED",
                    message: "Limite de consultas por usuario excedido. Aguarde um minuto.",
                    status: 429,
                },
            };
        }
    }

    return { ok: true };
}

export async function readCache(
    supabase: SupabaseClient,
    urlHash: string,
): Promise<{ html: string; upstream_status: number } | null> {
    // @ts-ignore
    const { data, error } = await supabase
        .from("nfce_fetch_cache")
        .select("html, upstream_status")
        .eq("url_hash", urlHash)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

    if (error) {
        console.warn(JSON.stringify({ event: "nfce_cache_read_failed", message: error.message }));
        return null;
    }
    if (!data?.html) return null;
    return { html: data.html, upstream_status: data.upstream_status ?? 200 };
}

export async function writeCache(
    supabase: SupabaseClient,
    urlHash: string,
    urlNormalized: string,
    html: string,
    upstreamStatus: number,
): Promise<void> {
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
    // @ts-ignore
    const { error } = await supabase.from("nfce_fetch_cache").upsert(
        {
            url_hash: urlHash,
            url_normalized: urlNormalized,
            html,
            upstream_status: upstreamStatus,
            expires_at: expiresAt,
        },
        { onConflict: "url_hash" },
    );

    if (error) {
        console.warn(JSON.stringify({ event: "nfce_cache_write_failed", message: error.message }));
    }
}

export async function tryCleanupStale(supabase: SupabaseClient): Promise<void> {
    // @ts-ignore
    const { error } = await supabase.rpc("nfce_cleanup_stale");
    if (error) {
        console.warn(JSON.stringify({ event: "nfce_cleanup_failed", message: error.message }));
    }
}

export async function writeLog(
    supabase: SupabaseClient,
    row: {
        url_hash: string;
        user_id: string | null;
        client_ip: string;
        cache_hit: boolean;
        success: boolean;
        error_code: string | null;
        upstream_status: number | null;
        duration_ms: number;
    },
): Promise<void> {
    // @ts-ignore
    const { error } = await supabase.from("nfce_fetch_log").insert(row);
    if (error) {
        console.warn(JSON.stringify({ event: "nfce_log_write_failed", message: error.message }));
    }
}