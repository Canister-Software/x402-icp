import type { PaymentRequirements } from '../types/index.js'
import { ASSETS } from '../types/index.js'

export interface CreateIcpPaymentRequirementsOptions {
  /** Amount in smallest unit (e8s for ICP, e6s for ckUSDC/ckUSDT) */
  amount: string
  /** Network identifier, e.g. 'icp:1:ryjl3-tyaaa-aaaaa-aaaba-cai' */
  network: string
  /** Recipient principal ID */
  payTo: string
  /** Max timeout in seconds (default: 300) */
  maxTimeoutSeconds?: number
  /**
   * Extra fields to include in payment requirements.
   *
   * When using a facilitator, `facilitatorPrincipal` is injected automatically
   * by `ExactIcpScheme.enhancePaymentRequirements` — you do not need to set it here.
   *
   * For self-hosted settlement (no facilitator), pass it manually:
   * `extra: { facilitatorPrincipal: 'your-principal' }`
   */
  extra?: Record<string, unknown>
}

export function createIcpPaymentRequirements(
  opts: CreateIcpPaymentRequirementsOptions
): PaymentRequirements {
  // network format: icp:1:<canisterId>
  const ledgerId = opts.network.split(':').pop()!
  const asset = ASSETS[ledgerId]

  return {
    scheme: 'exact',
    network: opts.network,
    amount: opts.amount,
    asset: opts.network, // asset = full network string for ICP
    payTo: opts.payTo,
    maxTimeoutSeconds: opts.maxTimeoutSeconds ?? 300,
    extra: {
      ...(asset ? { symbol: asset.symbol, decimals: asset.decimals } : {}),
      ...opts.extra,
    },
  } as PaymentRequirements
}
