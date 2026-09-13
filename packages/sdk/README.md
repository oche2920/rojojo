# @Rojojo/sdk

Unified payment execution layer for autonomous agents on Stellar. One SDK for x402, MPP charge, and MPP session — mode selected automatically from the provider's `Rojojo.json` manifest.

## Install

```bash
npm install @Rojojo/sdk
```

## Agent Usage

```ts
import { RojojoClient } from '@Rojojo/sdk/client'
import { Keypair } from '@stellar/stellar-sdk'

const client = new RojojoClient({
  wallet: Keypair.fromSecret(process.env.AGENT_SECRET),
  network: 'testnet',
  spendCap: { daily: '1.00', asset: 'USDC' },
})

// Single call — SDK reads manifest, picks mode automatically
const result = await client.pay('https://provider.example.com/price')
// result.data   — response body
// result.txHash — settlement hash (or null for session vouchers)
// result.mode   — 'x402' | 'mpp-charge' | 'mpp-session'

// Sustained streaming access
const session = await client.openSession('https://provider.example.com/stream/orderbook')
for await (const update of session.stream()) {
  console.log(update)
  if (done) break
}
await session.close() // triggers on-chain settlement
```

### Durable spend cap

The `spendCap` is enforced via a pluggable `SpendStore` (`read()` / `write()`).
By default the client uses an in-memory store that resets on every process
restart — and logs a startup warning — so the cap is **not** durable. For
production, inject a persistent implementation so a crash or restart can't reset
the accumulator and bypass the cap:

```ts
import { RojojoClient, type SpendStore, type DailySpend } from '@Rojojo/sdk/client'

const redisSpendStore: SpendStore = {
  async read(): Promise<DailySpend | null> {
    const raw = await redis.get('Rojojo:dailySpend')
    return raw ? (JSON.parse(raw) as DailySpend) : null
  },
  async write(state: DailySpend): Promise<void> {
    await redis.set('Rojojo:dailySpend', JSON.stringify(state))
  },
}

const client = new RojojoClient({
  wallet: Keypair.fromSecret(process.env.AGENT_SECRET),
  network: 'mainnet',
  spendCap: { daily: '1.00', asset: 'USDC' },
  spendStore: redisSpendStore,
})
```

## Provider Usage

```ts
import express from 'express'
import { Rojojo } from '@Rojojo/sdk/provider'

const app = express()

app.use('/price', Rojojo({
  modes: ['x402', 'mpp-charge'],
  pricing: { x402: '0.001', 'mpp-charge': '0.0008' },
  asset: 'USDC',
  assetContract: process.env.USDC_ASSET_CONTRACT,
  payee: process.env.STELLAR_PAYEE_ADDRESS,
  network: 'testnet',
  payeeSecretKey: process.env.STELLAR_PAYEE_SECRET,
  manifest,
  onSettled: async (txHash, amount, mode) => {
    console.log(`settled: ${mode} ${amount} USDC — ${txHash}`)
  },
}))
```

## Session Lifecycle Hooks

For `mpp-session` mode, the middleware exposes three hooks that fire at each stage of the payment channel lifecycle:

```ts
app.use('/stream', Rojojo({
  modes: ['mpp-session'],
  pricing: { 'mpp-session': { rate: '0.0001', channelContract: CHANNEL_CONTRACT } },
  asset: 'USDC',
  assetContract: USDC_ASSET_CONTRACT,
  payee: PAYEE_ADDRESS,
  network: 'testnet',
  payeeSecretKey: PAYEE_SECRET,
  manifest,
  commitmentPublicKey: COMMITMENT_PUBLIC_KEY,

  // Fires once when the first voucher is verified for a new session
  onSessionOpen: async (channelId) => {
    await db.from('sessions').insert({
      channel_id: channelId,
      status: 'open',
      voucher_count: 0,
    })
  },

  // Fires after each verified ed25519 commitment (off-chain, no tx fee)
  onVoucher: async (voucherIndex, cumulativeAmount) => {
    await db.from('sessions').update({
      voucher_count: voucherIndex,
      cumulative_amount: parseFloat(cumulativeAmount),
    }).eq('channel_id', channelId)
  },

  // Fires after the on-chain channel close settles the cumulative amount
  onSettled: async (txHash, totalPaid, mode) => {
    await db.from('sessions').update({
      status: 'closed',
      settlement_tx_hash: txHash,
    }).eq('channel_id', channelId)
  },
}))
```

| Hook | When it fires | On-chain? |
|---|---|---|
| `onSessionOpen(channelId)` | First verified voucher in a new session | No |
| `onVoucher(index, cumulativeAmount)` | Each verified ed25519 commitment | No |
| `onSettled(txHash, amount, mode)` | Channel close transaction confirmed | Yes |

## React Integration

`@Rojojo/sdk/react` provides hooks for client construction, payments, sessions, and live tx log subscription. Wrap your app with `RojojoProvider`:

```tsx
import { RojojoProvider, useRojojoClient } from '@Rojojo/sdk/react'
import { createClient } from '@supabase/supabase-js'

function App({ children }: { children: React.ReactNode }) {
  const client = useRojojoClient({
    wallet: process.env.NEXT_PUBLIC_AGENT_SECRET!,
    network: 'testnet',
    spendCap: { daily: '1.00', asset: 'USDC' },
  })
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  return (
    <RojojoProvider client={client} supabase={supabase}>
      {children}
    </RojojoProvider>
  )
}
```

### `usePay(url, options?)`

```tsx
import { usePay } from '@Rojojo/sdk/react'

function PriceButton() {
  const { pay, result, loading, error } = usePay('https://provider.example.com/price')
  if (error) return <span>Error: {error.message}</span>
  return (
    <button onClick={pay} disabled={loading}>
      {loading ? 'Paying…' : result ? `Paid: ${result.txHash}` : 'Pay 0.001 USDC'}
    </button>
  )
}
```

### `useSession(url)`

```tsx
import { useEffect } from 'react'
import { useSession } from '@Rojojo/sdk/react'

function StreamingFeed() {
  const { open, close, status, vouchers, cumulative } = useSession(
    'https://provider.example.com/stream/orderbook',
  )
  useEffect(() => { void open() }, [])
  return (
    <div>
      <p>Status: {status} — vouchers: {vouchers} — paid: {cumulative} USDC</p>
      <button onClick={close} disabled={status !== 'open'}>Close & settle</button>
    </div>
  )
}
```

The hook automatically fires `session.close()` in the background on unmount when status is `open` (best-effort settlement).

### `useTxLog(filter?)`

```tsx
import { useTxLog } from '@Rojojo/sdk/react'

function ActivityFeed({ channelId }: { channelId: string }) {
  const txLog = useTxLog({ channelId, limit: 25 })
  return (
    <ul>
      {txLog.map((row) => (
        <li key={row.id}>{row.mode} — {row.amount} USDC — {row.tx_hash}</li>
      ))}
    </ul>
  )
}
```

| Hook | Returns | Requires from `RojojoProvider` |
|---|---|---|
| `useRojojoClient(config)` | Memoized `RojojoClient` | — (creator hook) |
| `usePay(url, options?)` | `{ pay, result, loading, error }` | `client` |
| `useSession(url)` | `{ session, status, vouchers, cumulative, error, open, close }` | `client` (with `commitmentSecret`) |
| `useTxLog(filter?)` | `TxLogRow[]` (newest first) | `supabase` |

React is a peer dependency — install `react@^18` (or `^19`) in your app.

---

## Error Handling

All SDK failures extend `RojojoError` with a stable `code`, `retryable` flag, and optional `cause`. Transient failures (network timeouts, facilitator 5xx, Horizon RPC errors) are retried automatically with exponential backoff unless you disable retries.

```ts
import {
  RojojoClient,
  RojojoError,
  RojojoFacilitatorError,
  RojojoManifestError,
  RojojoPolicyRejectError,
} from '@Rojojo/sdk/client'

const client = new RojojoClient({
  wallet: process.env.AGENT_SECRET!,
  network: 'testnet',
  retryPolicy: { maxAttempts: 4, baseDelayMs: 250 },
})

try {
  const result = await client.pay('https://provider.example.com/price')
  console.log(result.mode, result.txHash)
} catch (err) {
  if (err instanceof RojojoPolicyRejectError) {
    console.error('Spend cap exceeded:', err.reason)
  } else if (err instanceof RojojoFacilitatorError) {
    console.error(`Facilitator HTTP ${err.status} (retryable=${err.retryable})`)
  } else if (err instanceof RojojoManifestError) {
    console.error('Manifest or config problem:', err.message)
  } else if (err instanceof RojojoError) {
    console.error(`[${err.code}] ${err.message} (retryable=${err.retryable})`)
  } else {
    throw err
  }
}
```

| Error | `retryable` | Typical cause |
|---|---|---|
| `RojojoManifestError` | no | Invalid manifest, missing pricing fields |
| `RojojoNoSupportedModeError` | no | Provider has no compatible payment mode |
| `RojojoFacilitatorError` | yes | Facilitator/provider 429 or 5xx |
| `RojojoNetworkError` | yes | Timeouts, connection failures |
| `RojojoSignatureError` | no | Signing or commitment failure |
| `RojojoVoucherMonotonicityError` | no | Non-increasing voucher amount |
| `RojojoPolicyRejectError` | no | Local spend cap exceeded |
| `RojojoChannelStateError` | no | Channel simulate/close invariant violation |

## Mode Selection Logic

The `ModeRouter` uses this decision tree (deterministic, no randomness):

1. If `{ sustained: true }` passed AND manifest supports `mpp-session` → session
2. Else if manifest supports `mpp-charge` AND network is Stellar → MPP charge (lower fees)
3. Else if manifest supports `x402` → x402 with facilitator
4. Else throw `RojojoNoSupportedModeError`

Override with `{ forceMode: 'x402' }` to bypass auto-selection.

## Dispute Resolution

For `mpp-session` mode, the session handle exposes three methods to handle server unavailability or crashes:

```ts
const session = await client.openSession('https://provider.example.com/stream')

// Check the current dispute status (open, in-refund-window, refundable, settled)
const status = await session.getDisputeStatus()

// If server is unresponsive, request a refund (starts the refund window)
const refundTxHash = await session.requestRefund()

// Server-side: settle with the latest signed voucher before refund window expires
const settleTxHash = await session.settleWithLatestVoucher()
```

| Method | Purpose | Requires | Returns |
|--------|---------|----------|---------|
| `getDisputeStatus()` | Query channel state | None | `'open' \| 'in-refund-window' \| 'refundable' \| 'settled'` |
| `requestRefund()` | Initiate refund process | Signed agent keypair | Transaction hash (string) |
| `settleWithLatestVoucher()` | Server counter-settle | Latest voucher signature | Transaction hash (string) |

Raises: `RojojoDisputeError`, `RojojoChannelStateError`, `RojojoRefundWindowError`

## Security

The `one-way-channel` Soroban contract wrapped by `MppSessionClient` is **unaudited** (`stellar-experimental/one-way-channel`). Safe defaults are enforced: 17280 ledger refund window, monotonic cumulative enforcement at application, database, and contract layers. Production mainnet use should await a formal audit.

## License

MIT
