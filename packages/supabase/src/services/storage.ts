import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseError } from '../errors'

/**
 * Faz upload de um arquivo para um bucket do Supabase Storage.
 * Lança SupabaseError em caso de falha.
 *
 * @example
 * const result = await upload(client, 'avatars', 'user-123.jpg', file)
 */
export async function upload(
    client: SupabaseClient,
    bucket: string,
    path: string,
    file: File | Blob | ArrayBuffer,
    options?: { contentType?: string; upsert?: boolean }
) {
    const { data, error } = await client.storage
        .from(bucket)
        .upload(path, file, options)

    if (error) throw new SupabaseError('STORAGE_UPLOAD_FAILED', error.message, error)
    return data
}

/**
 * Faz download de um arquivo de um bucket do Supabase Storage.
 * Lança SupabaseError em caso de falha.
 *
 * @example
 * const blob = await download(client, 'receipts', 'nota-fiscal-123.pdf')
 */
export async function download(
    client: SupabaseClient,
    bucket: string,
    path: string
): Promise<Blob> {
    const { data, error } = await client.storage.from(bucket).download(path)
    if (error) throw new SupabaseError('STORAGE_DOWNLOAD_FAILED', error.message, error)
    return data
}

/**
 * Remove um ou mais arquivos de um bucket do Supabase Storage.
 * Lança SupabaseError em caso de falha.
 *
 * @example
 * await remove(client, 'temp', ['file1.pdf', 'file2.pdf'])
 */
export async function remove(
    client: SupabaseClient,
    bucket: string,
    paths: string[]
): Promise<unknown> {
    const { data, error } = await client.storage.from(bucket).remove(paths)
    if (error) throw new SupabaseError('STORAGE_DELETE_FAILED', error.message, error)
    return data
}

/**
 * Retorna a URL pública de um arquivo em um bucket público.
 * Não faz requisição — apenas constrói a URL.
 *
 * @example
 * const url = getPublicUrl(client, 'avatars', 'user-123.jpg')
 */
export function getPublicUrl(
    client: SupabaseClient,
    bucket: string,
    path: string
): string {
    const { data } = client.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
}