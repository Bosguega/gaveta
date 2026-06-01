/**
 * Constantes de domínio do device-mode.
 *
 * Aqui ficam apenas regras de negócio — sem emojis, cores, labels ou
 * qualquer detalhe de apresentação. Esses itens pertencem à camada de UI
 * de cada app.
 */

/**
 * Media query usada para resolver `DeviceMode = 'auto'`.
 *
 * Viewports com largura mínima de 768px são considerados "desktop" pela
 * regra atual. Tablets (≥768px) também disparam esta media query, e a
 * flag `isDesktop` retorna `true` para eles — ver `deriveDeviceFlags`.
 */
export const DEVICE_DESKTOP_MEDIA_QUERY = '(min-width: 768px)'
