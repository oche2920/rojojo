import { createContext, useContext, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RojojoClient } from '../client/RojojoClient.js'

export interface RojojoContextValue {
  client: RojojoClient
  supabase?: SupabaseClient
}

const RojojoContext = createContext<RojojoContextValue | null>(null)

export interface RojojoProviderProps extends RojojoContextValue {
  children: ReactNode
}

/**
 * Wraps an app with Rojojo client + optional Supabase instance.
 * Child hooks (`usePay`, `useSession`, `useTxLog`) read from this context.
 *
 * @example
 * const client = useRojojoClient({ wallet: secret, network: 'testnet' })
 * return <RojojoProvider client={client} supabase={supabase}>{children}</RojojoProvider>
 */
export function RojojoProvider(props: RojojoProviderProps) {
  const { children, client, supabase } = props
  const value: RojojoContextValue = supabase ? { client, supabase } : { client }
  return (
    <RojojoContext.Provider value={value}>
      {children}
    </RojojoContext.Provider>
  )
}

export function useRojojoContext(): RojojoContextValue {
  const ctx = useContext(RojojoContext)
  if (!ctx) {
    throw new Error('useRojojoContext must be used inside <RojojoProvider>')
  }
  return ctx
}
