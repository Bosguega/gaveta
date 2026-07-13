/**
 * fetch-nfce — cache (Postgres), rate limit, retries, logs.
 * Contrato de resposta mantido: sucesso { success, html, source, status } | erro { success: false, error, message, status }.
 */

import { corsHeaders, json } from "./http.ts";
import { validateNfceUrl } from "./validation.ts";
import { fetchSefazWithRetries } from "./sefaz.ts";
import {
    readCache,
    tryCleanupStale,
    tryRateLimit,
    writeCache,
    writeLog,
} from "./supabaseStore.ts";
import { logInfo, logWarn } from "./logger.ts";
import type { SuccessBody, ErrorBody } from "./types.ts";

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos
let lastCleanupAt = 0;

async function sha256Hex(input: string): Promise<string> {
    const data = new TextEncoder().encode(input);
    // @ts-ignore - crypto is available in Edge Runtime
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

function getClientIp(req: Request): string {
    return (
        req.headers.get("cf-connecting-ip") ??
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown"
    );
}

function decodeJwtSub(req: Request): string | null {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return null;
    const token = auth.slice(7).trim();
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    try {
        let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const pad = base64.length % 4;
        if (pad) base64 += "=".repeat(4 - pad);
        const payload = JSON.parse(atob(base64)) as { sub?: string };
        return typeof payload.sub === "string" ? payload.sub : null;
    } catch {
        return null;
    }
}

// @ts-ignore - Deno.serve is available in Edge Runtime
Deno.serve(async (req: Request) => {
    const t0 = Date.now();

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return json(
            {
                success: false,
                error: "METHOD_NOT_ALLOWED",
                message: "Use POST com JSON { url }.",
                status: 405,
            } as ErrorBody,
            405,
        );
    }

    let payload: unknown;
    try {
        payload = await req.json();
    } catch {
        return json(
            {
                success: false,
                error: "INVALID_JSON",
                message: "Corpo da requisição deve ser JSON.",
                status: 400,
            } as ErrorBody,
            400,
        );
    }

    const urlField =
        typeof payload === "object" && payload !== null && "url" in payload
            ? (payload as { url: unknown }).url
            : undefined;

    const validated = validateNfceUrl(urlField);
    if (!validated.ok) {
        return json(validated.body, 200);
    }

    const targetUrl = validated.url.toString();
    const urlHash = await sha256Hex(targetUrl);
    const clientIp = getClientIp(req);
    const userId = decodeJwtSub(req);

    // @ts-ignore - Deno.env is available in Edge Runtime
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    // @ts-ignore - Deno.env is available in Edge Runtime
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    // @ts-ignore - createClient is available in Deno runtime
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.99.3");
    const supabase = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

    const finish = async (
        body: SuccessBody | ErrorBody,
        opts: { cacheHit: boolean },
    ): Promise<Response> => {
        if (supabase) {
            try {
                await writeLog(supabase, {
                    url_hash: urlHash,
                    user_id: userId,
                    client_ip: clientIp,
                    cache_hit: opts.cacheHit,
                    success: body.success,
                    error_code: body.success ? null : body.error,
                    upstream_status: body.status,
                    duration_ms: Date.now() - t0,
                });
            } catch (err: unknown) {
                logWarn("nfce_log_write_unhandled", { error: String(err) });
            }
        }

        logInfo("nfce_fetch_done", {
            url_hash: urlHash,
            cache_hit: opts.cacheHit,
            success: body.success,
            error: body.success ? undefined : body.error,
            duration_ms: Date.now() - t0,
        });

        return json(body, 200);
    };

    if (!supabase) {
        logWarn("nfce_no_supabase_env", { message: "cache/rate/log desativados" });
        const live = await fetchSefazWithRetries(targetUrl);
        if (live.ok) {
            return finish(
                { success: true, html: live.html, source: "sefaz", status: live.status },
                { cacheHit: false },
            );
        }
        return finish(live.body, { cacheHit: false });
    }

    const now = Date.now();
    if (now - lastCleanupAt > CLEANUP_INTERVAL_MS) {
        lastCleanupAt = now;
        // @ts-ignore - tryCleanupStale accepts SupabaseClient
        tryCleanupStale(supabase).catch((e: unknown) =>
            logWarn("nfce_cleanup_unhandled", { error: String(e) }),
        );
    }

    const rate = await tryRateLimit(supabase, clientIp, userId);
    if (!rate.ok) {
        return finish(rate.body, { cacheHit: false });
    }

    const cached = await readCache(supabase, urlHash);
    if (cached) {
        return finish(
            {
                success: true,
                html: cached.html,
                source: "cache",
                status: cached.upstream_status,
            },
            { cacheHit: true },
        );
    }

    const live = await fetchSefazWithRetries(targetUrl);
    if (live.ok) {
        await writeCache(supabase, urlHash, targetUrl, live.html, live.status);
        return finish(
            { success: true, html: live.html, source: "sefaz", status: live.status },
            { cacheHit: false },
        );
    }

    return finish(live.body, { cacheHit: false });
});