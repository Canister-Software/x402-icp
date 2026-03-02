import type {
  PaymentRequirements,
  Network,
  Price,
  AssetAmount,
  SchemeNetworkServer,
} from '@x402/core/types'
import { ASSETS } from '../types/index.js'

export class ExactIcpScheme implements SchemeNetworkServer {
  readonly scheme = 'exact'

  /**
   * Convert a price to ICP asset amount.
   *
   * - If price is already an AssetAmount, pass through.
   * - If price is a string/number in smallest units (e8s), use with the
   *   network's default asset.
   * - USD-denominated prices (e.g. "$0.10") are not yet supported.
   */
  async parsePrice(price: Price, network: Network): Promise<AssetAmount> {
    // Already an AssetAmount
    if (typeof price === 'object' && 'amount' in price && 'asset' in price) {
      return price
    }

    const raw = typeof price === 'number' ? price.toString() : price as string

    if (raw.startsWith('$')) {
      throw new Error(
        'USD price conversion not yet supported for ICP. ' +
        'Specify amount in smallest token units (e8s for ICP, e6s for ckUSDC).'
      )
    }

    // network format: icp:1:<canisterId>
    const ledgerId = network.split(':').pop()!
    const asset = ASSETS[ledgerId]

    if (!asset) {
      throw new Error(`Unknown ICP asset for network: ${network}`)
    }

    return {
      amount: raw,
      asset: network, // asset = full network string, facilitator strips canisterId
    }
  }

  /**
   * Merge facilitator extra data (e.g. facilitatorPrincipal) into requirements.
   */
  async enhancePaymentRequirements(
    paymentRequirements: PaymentRequirements,
    supportedKind: {
      x402Version: number
      scheme: string
      network: Network
      extra?: Record<string, unknown>
    },
    _facilitatorExtensions: string[],
  ): Promise<PaymentRequirements> {
    const ledgerId = paymentRequirements.network.split(':').pop()!
    const asset = ASSETS[ledgerId]

    return {
      ...paymentRequirements,
      extra: {
        ...paymentRequirements.extra,
        // Merge in facilitator-provided extra (e.g. facilitatorPrincipal)
        ...supportedKind.extra,
        // Add asset metadata for clients
        ...(asset ? { symbol: asset.symbol, decimals: asset.decimals } : {}),
      },
    }
  }
}