import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
GlobalRegistrator.register()
import * as RTL from '@testing-library/react'
const { renderHook } = RTL
import { Keypair } from '@stellar/stellar-sdk'
import { useRojojoClient } from '../useRojojoClient.js'
import { RojojoClient } from '../../client/RojojoClient.js'

describe('useRojojoClient', () => {
  it('returns a memoized RojojoClient instance', () => {
    const secret = Keypair.random().secret()
    const { result, rerender } = renderHook(() =>
      useRojojoClient({ wallet: secret, network: 'testnet' }),
    )
    const first = result.current

    rerender()

    assert.ok(first instanceof RojojoClient)
    assert.equal(result.current, first, 'identity is stable across rerenders')
  })

  it('rebuilds when wallet changes', () => {
    const a = Keypair.random().secret()
    const b = Keypair.random().secret()
    const { result, rerender } = renderHook(
      ({ secret }: { secret: string }) =>
        useRojojoClient({ wallet: secret, network: 'testnet' }),
      { initialProps: { secret: a } },
    )
    const first = result.current

    rerender({ secret: b })

    assert.notEqual(result.current, first)
  })
})
