/** Stable error codes for programmatic handling. */
export type RojojoErrorCode =
  | 'MANIFEST'
  | 'MANIFEST_TIMEOUT'
  | 'MANIFEST_SUNSET'
  | 'NO_SUPPORTED_MODE'
  | 'FACILITATOR'
  | 'NETWORK'
  | 'SIGNATURE'
  | 'VOUCHER_MONOTONICITY'
  | 'POLICY_REJECT'
  | 'CHANNEL_STATE'
  | 'DISPUTE'
  | 'REFUND_WINDOW'
  | 'CLIENT_VERSION_TOO_OLD'
  | 'TRUSTLINE'

export interface RojojoErrorOptions {
  cause?: unknown
  /** Milliseconds to wait before retry (e.g. from Retry-After header). */
  retryAfterMs?: number
}

/** Base error for all Rojojo SDK failures. */
export class RojojoError extends Error {
  readonly code: RojojoErrorCode
  readonly retryable: boolean
  readonly retryAfterMs?: number

  constructor(
    message: string,
    code: RojojoErrorCode,
    retryable: boolean,
    options: RojojoErrorOptions = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'RojojoError'
    this.code = code
    this.retryable = retryable
    if (options.retryAfterMs !== undefined) {
      this.retryAfterMs = options.retryAfterMs
    }
  }
}

/** Manifest fetch failed, schema invalid, or required fields missing. */
export class RojojoManifestError extends RojojoError {
  constructor(message: string, options: RojojoErrorOptions = {}) {
    super(message, 'MANIFEST', false, options)
    this.name = 'RojojoManifestError'
  }
}

/** Manifest fetch exceeded the configured timeout without receiving a response. */
export class RojojoManifestTimeoutError extends RojojoError {
  constructor(message: string, options: RojojoErrorOptions = {}) {
    super(message, 'MANIFEST_TIMEOUT', true, options)
    this.name = 'RojojoManifestTimeoutError'
  }
}

/** The provider's signed manifest has reached its declared sunset timestamp. */
export class RojojoManifestSunsetError extends RojojoError {
  constructor(message: string, options: RojojoErrorOptions = {}) {
    super(message, 'MANIFEST_SUNSET', false, options)
    this.name = 'RojojoManifestSunsetError'
  }
}

/** No payment mode in the manifest is supported by this client. */
export class RojojoNoSupportedModeError extends RojojoError {
  constructor(message: string, options: RojojoErrorOptions = {}) {
    super(message, 'NO_SUPPORTED_MODE', false, options)
    this.name = 'RojojoNoSupportedModeError'
  }
}

/** This client's SDK version is below the manifest's min_client_version. Upgrade the SDK to proceed. */
export class RojojoClientVersionError extends RojojoError {
  constructor(message: string, options: RojojoErrorOptions = {}) {
    super(message, 'CLIENT_VERSION_TOO_OLD', false, options)
    this.name = 'RojojoClientVersionError'
  }
}

/**
 * Account is missing a trustline for the payment asset.
 * Thrown preflight — before any payment transaction is submitted —
 * so the caller can establish the trustline first.
 */
export class RojojoTrustlineError extends RojojoError {
  readonly asset: string
  readonly issuer: string
  readonly remediation: string

  constructor(
    asset: string,
    issuer: string,
    remediation: string,
    options: RojojoErrorOptions = {},
  ) {
    super(
      `Missing trustline for ${asset} (issuer: ${issuer}). ${remediation}`,
      'TRUSTLINE',
      false,
      options,
    )
    this.name = 'RojojoTrustlineError'
    this.asset = asset
    this.issuer = issuer
    this.remediation = remediation
  }
}

/** x402 facilitator or provider returned a retryable HTTP failure (5xx, 429). */
export class RojojoFacilitatorError extends RojojoError {
  readonly status: number

  constructor(
    message: string,
    status: number,
    options: RojojoErrorOptions = {},
  ) {
    super(message, 'FACILITATOR', true, options)
    this.name = 'RojojoFacilitatorError'
    this.status = status
  }
}

/** Transient network failure (timeouts, connection reset, unreachable host). */
export class RojojoNetworkError extends RojojoError {
  constructor(message: string, options: RojojoErrorOptions = {}) {
    super(message, 'NETWORK', true, options)
    this.name = 'RojojoNetworkError'
  }
}

/** Payment or commitment signature could not be produced or verified. */
export class RojojoSignatureError extends RojojoError {
  constructor(message: string, options: RojojoErrorOptions = {}) {
    super(message, 'SIGNATURE', false, options)
    this.name = 'RojojoSignatureError'
  }
}

/** Voucher cumulative amount did not increase monotonically. */
export class RojojoVoucherMonotonicityError extends RojojoError {
  constructor(message: string, options: RojojoErrorOptions = {}) {
    super(message, 'VOUCHER_MONOTONICITY', false, options)
    this.name = 'RojojoVoucherMonotonicityError'
  }
}

/** Local spend cap or on-chain policy rejected the payment. */
export class RojojoPolicyRejectError extends RojojoError {
  readonly reason: string

  constructor(reason: string, options: RojojoErrorOptions = {}) {
    super(`Payment rejected by policy: ${reason}`, 'POLICY_REJECT', false, options)
    this.name = 'RojojoPolicyRejectError'
    this.reason = reason
  }
}

/** Channel lifecycle failure (open, simulate, close, missing settlement fields). */
export class RojojoChannelStateError extends RojojoError {
  constructor(message: string, options: RojojoErrorOptions = {}) {
    super(message, 'CHANNEL_STATE', false, options)
    this.name = 'RojojoChannelStateError'
  }
}

/** Channel dispute operation failed (refund request, settlement, or contract invariant). */
export class RojojoDisputeError extends RojojoError {
  constructor(message: string, options: RojojoErrorOptions = {}) {
    super(message, 'DISPUTE', false, options)
    this.name = 'RojojoDisputeError'
  }
}

/** Refund window has not yet opened or has already expired. */
export class RojojoRefundWindowError extends RojojoError {
  constructor(message: string, options: RojojoErrorOptions = {}) {
    super(message, 'REFUND_WINDOW', false, options)
    this.name = 'RojojoRefundWindowError'
  }
}

/** @deprecated Use {@link RojojoPolicyRejectError} */
export const RojojoPolicyRejectedError = RojojoPolicyRejectError

/** @deprecated Use {@link RojojoVoucherMonotonicityError} or {@link RojojoChannelStateError} */
export const RojojoSessionError = RojojoVoucherMonotonicityError

/** Parse Retry-After from a Response (seconds or HTTP-date). */
export function parseRetryAfterMs(response: Response): number | undefined {
  const header = response.headers.get('Retry-After')
  if (!header) return undefined

  const seconds = Number(header)
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return seconds * 1000
  }

  const date = Date.parse(header)
  if (!Number.isNaN(date)) {
    return Math.max(0, date - Date.now())
  }

  return undefined
}

/** Map an HTTP status to a typed, retryable-aware Rojojo error. */
export function httpStatusToError(
  message: string,
  status: number,
  response?: Response,
): RojojoError {
  const retryAfterMs = response ? parseRetryAfterMs(response) : undefined
  const opts = retryAfterMs !== undefined ? { retryAfterMs } : {}

  if (status === 429 || status === 503 || (status >= 500 && status < 600)) {
    return new RojojoFacilitatorError(message, status, opts)
  }

  if (status >= 400) {
    return new RojojoManifestError(message, opts)
  }

  return new RojojoNetworkError(message, opts)
}

/** Wrap a low-level fetch failure; preserves existing RojojoErrors. */
export function wrapFetchError(err: unknown, context: string): RojojoError {
  if (err instanceof RojojoError) return err
  return new RojojoNetworkError(`${context}: ${String(err)}`, { cause: err })
}