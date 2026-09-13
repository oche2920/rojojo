/**
 * USDC conversion — canonical implementation lives in @rojojo/nulth-sdk and is
 * re-exported here so SDK consumers (client, provider) share one converter.
 *
 * @rojojo/rojojo already depends on @rojojo/nulth-sdk, so re-exporting
 * (rather than defining a parallel helper) keeps a single source of truth.
 */
import { usdcToStroops, USDC_DECIMALS } from '@rojojo/nulth-sdk'
export { usdcToStroops, USDC_DECIMALS }

/**
 * @deprecated Use {@link usdcToStroops} — the same validated bigint converter.
 * Kept as a thin alias so existing call sites keep working during migration.
 */
export const usdcToUnits = usdcToStroops
