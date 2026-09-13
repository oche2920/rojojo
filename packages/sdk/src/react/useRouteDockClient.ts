import { useEffect, useMemo } from 'react'
import { Keypair } from '@stellar/stellar-sdk'
import { RojojoClient, type RojojoClientConfig } from '../client/RojojoClient.js'

/**
 * Returns a memoized RojojoClient. Re-creates only when wallet / network /
 * spendCap / commitmentSecret / retryPolicy identity changes.
 *
 * @example
 * const client = useRojojoClient({
 *   wallet: process.env.NEXT_PUBLIC_AGENT_SECRET!,
 *   network: 'testnet',
 *   spendCap: { daily: '1.00', asset: 'USDC' },
 * })
 */
export function useRojojoClient(config: RojojoClientConfig): RojojoClient {
  const walletKey =
    typeof config.wallet === 'string' ? config.wallet : (config.wallet as Keypair).secret()
  const spendCapKey = config.spendCap
    ? `${config.spendCap.daily}|${config.spendCap.asset}`
    : ''
  const retryKey = config.retryPolicy
    ? `${config.retryPolicy.maxAttempts}|${config.retryPolicy.baseDelayMs}`
    : ''

  const client = useMemo(
    () => new RojojoClient(config),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [walletKey, config.network, spendCapKey, config.commitmentSecret, retryKey],
  )

  // Dispose the commitment secret when the client instance is replaced or the
  // component unmounts, so the secret does not linger in the WeakMap.
  useEffect(() => () => client.dispose(), [client])

  return client
}
