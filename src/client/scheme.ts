import type { IcpPayload, IcpPayloadAuthorization, AssetConfig } from '../types/index.js'
import { ASSETS } from '../types/index.js'
import type { IcpSigner } from './signer.js'

/**
 * x402 PaymentRequirements as received from the 402 response.
 * We define locally to avoid hard coupling to @x402/core version.
 */
interface PaymentRequirements {
  scheme: string
  network: string
  amount: string
  asset: string
  payTo: string
  maxTimeoutSeconds: number
  extra?: Record<string, unknown>
}

/**
 * ExactIcpClient implements SchemeNetworkClient for ICP.
 *
 * When @x402/fetch receives a 402 with network "icp:*", it calls
 * createPaymentPayload() which:
 *   1. Calls icrc2_approve on the ledger (authorize facilitator to spend)
 *   2. Signs the authorization object
 *   3. Returns the payload for the x-payment header
 */
export class ExactIcpClient {
  readonly scheme = 'exact'
  private signer: IcpSigner

  constructor(signer: IcpSigner) {
    this.signer = signer
  }

  /**
   * Create a payment payload from 402 payment requirements.
   * Called by x402Client when it matches an icp:* network.
   *
   * Signature matches SchemeNetworkClient: (x402Version, requirements) => payload
   */
  async createPaymentPayload(
    x402Version: number,
    requirements: PaymentRequirements
  ): Promise<{ x402Version: number; payload: IcpPayload }> {
    // Extract ledger canister ID from network: icp:1:<canisterId>
    const network = requirements.network
    if (!network) {
      throw new Error(`[ExactIcpClient] requirements.network is undefined.`)
    }
    const ledgerId = network.split(':').pop()!
    const asset = ASSETS[ledgerId]
    if (!asset) {
      throw new Error(`Unknown ICP asset for network: ${network}`)
    }

    // Get facilitator principal from requirements.extra
    const facilitatorPrincipal = requirements.extra?.facilitatorPrincipal as string
    if (!facilitatorPrincipal) {
      throw new Error(
        'Missing facilitatorPrincipal in payment requirements extra. ' +
        'The resource server must include this from the facilitator.'
      )
    }

    const amount = BigInt(requirements.amount)
    const nonce = Date.now()
    const expiresAt = Date.now() + (requirements.maxTimeoutSeconds * 1000)

    // Step 1: Approve the facilitator to spend our tokens via ICRC-2
    await this.signer.icrc2Approve({
      ledgerCanisterId: ledgerId,
      spender: facilitatorPrincipal,
      amount: amount + BigInt(asset.transferFee),
      expiresAt: BigInt(expiresAt) * 1_000_000n,
    })

    // Step 2: Build the authorization object (all JSON-safe types)
    const authorization: IcpPayloadAuthorization = {
      to: String(requirements.payTo),
      value: String(requirements.amount),
      expiresAt: Number(expiresAt),
      nonce: Number(nonce),
    }

    // Step 3: Sign the authorization
    const signature = await this.signer.signAuthorization(authorization)

    // Return only JSON-safe payload — no BigInts
    return {
      x402Version,
      payload: {
        signature,
        authorization,
      },
    }
  }
}