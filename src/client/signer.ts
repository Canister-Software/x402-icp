import type { IcpPayloadAuthorization } from '../types/index.js'
import { ExactIcpClient } from './scheme.js'

// ─── Signer Interface ────────────────────────────────────────────────────────

export interface Icrc2ApproveParams {
  ledgerCanisterId: string
  spender: string
  amount: bigint
  expiresAt?: bigint
}

export interface IcpSigner {
  /** The principal ID of this signer */
  readonly principal: string
  /** Call icrc2_approve on a ledger canister */
  icrc2Approve(params: Icrc2ApproveParams): Promise<bigint>
  /** Sign an authorization object, return base64url-encoded CBOR envelope */
  signAuthorization(auth: IcpPayloadAuthorization): Promise<string>
}

// ─── PEM File Signer ─────────────────────────────────────────────────────────

export interface PemSignerOptions {
  /** PEM file contents (string) — as exported by dfx */
  pem: string
  /** IC host URL (default: https://icp-api.io) */
  host?: string
}

/**
 * Create an ICP signer from a PEM file (as used by dfx identity export).
 *
 * @example
 * ```typescript
 * import { createPemSigner } from '@canister-software/x402-icp/client'
 * import fs from 'fs'
 *
 * const pem = fs.readFileSync('identity.pem', 'utf8')
 * const signer = await createPemSigner({ pem })
 * ```
 */
export async function createPemSigner(opts: PemSignerOptions): Promise<IcpSigner> {
  const { Ed25519KeyIdentity } = await import('@dfinity/identity')

  // Parse PEM to DER bytes
  const pemBody = opts.pem
    .replace(/-----BEGIN[^-]*-----/, '')
    .replace(/-----END[^-]*-----/, '')
    .replace(/\s/g, '')
  const derBuf = Buffer.from(pemBody, 'base64')
  const derBytes = new Uint8Array(derBuf.buffer, derBuf.byteOffset, derBuf.byteLength)

  let identity: any

  // Try Ed25519 first — extract last 32 bytes as seed
  try {
    const seed = derBytes.slice(derBytes.length - 32)
    identity = Ed25519KeyIdentity.generate(seed)
  } catch {
    // Fall back to Secp256k1
    try {
      const { Secp256k1KeyIdentity } = await import('@dfinity/identity-secp256k1')
      identity = Secp256k1KeyIdentity.fromSecretKey(derBytes.buffer as ArrayBuffer)
    } catch {
      throw new Error(
        'Could not parse PEM as Ed25519 or Secp256k1. ' +
          'For Secp256k1, install: npm install @dfinity/identity-secp256k1'
      )
    }
  }

  return createIdentitySigner({ identity, host: opts.host })
}

// ─── Identity Signer ─────────────────────────────────────────────────────────

export interface IdentitySignerOptions {
  /** Any @dfinity/identity Identity implementation */
  identity: any
  /** IC host URL (default: https://icp-api.io) */
  host?: string
}

/**
 * Create an ICP signer from an existing @dfinity/identity.
 *
 * @example
 * ```typescript
 * import { createIdentitySigner } from '@canister-software/x402-icp/client'
 * import { Ed25519KeyIdentity } from '@dfinity/identity'
 *
 * const identity = Ed25519KeyIdentity.generate()
 * const signer = await createIdentitySigner({ identity })
 * ```
 */
export async function createIdentitySigner(opts: IdentitySignerOptions): Promise<IcpSigner> {
  const { HttpAgent } = await import('@dfinity/agent')
  const { Principal } = await import('@dfinity/principal')
  const { IDL } = await import('@dfinity/candid')

  const host = opts.host ?? 'https://icp-api.io'
  const identity = opts.identity

  const agent = await HttpAgent.create({ identity, host })

  // Fetch root key for local dev
  if (host.includes('127.0.0.1') || host.includes('localhost')) {
    await agent.fetchRootKey()
  }

  const principal = identity.getPrincipal().toText()

  return {
    principal,

    async icrc2Approve(params: Icrc2ApproveParams): Promise<bigint> {
      const { Actor } = await import('@dfinity/agent')

      const icrc2Interface = IDL.Service({
        icrc2_approve: IDL.Func(
          [
            IDL.Record({
              fee: IDL.Opt(IDL.Nat),
              memo: IDL.Opt(IDL.Vec(IDL.Nat8)),
              from_subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
              created_at_time: IDL.Opt(IDL.Nat64),
              amount: IDL.Nat,
              expected_allowance: IDL.Opt(IDL.Nat),
              expires_at: IDL.Opt(IDL.Nat64),
              spender: IDL.Record({
                owner: IDL.Principal,
                subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
              }),
            }),
          ],
          [
            IDL.Variant({
              Ok: IDL.Nat,
              Err: IDL.Variant({
                GenericError: IDL.Record({ message: IDL.Text, error_code: IDL.Nat }),
                TemporarilyUnavailable: IDL.Null,
                Duplicate: IDL.Record({ duplicate_of: IDL.Nat }),
                BadFee: IDL.Record({ expected_fee: IDL.Nat }),
                AllowanceChanged: IDL.Record({ current_allowance: IDL.Nat }),
                CreatedInFuture: IDL.Record({ ledger_time: IDL.Nat64 }),
                TooOld: IDL.Null,
                Expired: IDL.Record({ ledger_time: IDL.Nat64 }),
                InsufficientFunds: IDL.Record({ balance: IDL.Nat }),
              }),
            }),
          ],
          []
        ),
      })

      const ledger = Actor.createActor(() => icrc2Interface, {
        agent,
        canisterId: params.ledgerCanisterId,
      })

      const result = await (ledger as any).icrc2_approve({
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
        amount: params.amount,
        expected_allowance: [],
        expires_at: params.expiresAt !== undefined ? [params.expiresAt] : [],
        spender: {
          owner: Principal.fromText(params.spender),
          subaccount: [],
        },
      })

      if ('Err' in result) {
        const errKey = Object.keys(result.Err)[0]
        const errVal = result.Err[errKey]
        throw new Error(
          `ICRC-2 approve failed: ${errKey} - ${JSON.stringify(errVal, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))}`
        )
      }

      return BigInt(result.Ok.toString())
    },

    async signAuthorization(auth: IcpPayloadAuthorization): Promise<string> {
      const { encode, rfc8949EncodeOptions } = await import('cborg')
      const { sha3_256 } = await import('@noble/hashes/sha3.js')

      // CBOR-encode with deterministic options, then sha3_256 — must match facilitator's computeDigest
      const cborBytes = encode(auth, rfc8949EncodeOptions)
      const digest = sha3_256(cborBytes)
      const signature = await identity.sign(digest)

      // Build the ic-auth envelope: { p: publicKey, s: signature }
      const publicKeyDer = identity.getPublicKey().toDer()
      const envelope = encode({
        p: new Uint8Array(publicKeyDer),
        s: new Uint8Array(signature),
      })

      // Return as base64url
      return base64urlEncode(new Uint8Array(envelope))
    },
  }
}

// ─── Registration Helper ─────────────────────────────────────────────────────

interface X402ClientLike {
  register(network: string, scheme: any): X402ClientLike
}

/**
 * Register the ICP exact payment scheme with an x402Client.
 *
 * Mirrors registerExactEvmScheme(client, { signer }) from @x402/evm.
 *
 * @example
 * ```typescript
 * import { x402Client } from '@x402/core/client'
 * import { wrapFetchWithPayment } from '@x402/fetch'
 * import { registerExactIcpScheme, createPemSigner } from '@canister-software/x402-icp/client'
 * import fs from 'fs'
 *
 * const signer = await createPemSigner({ pem: fs.readFileSync('identity.pem', 'utf8') })
 * const client = new x402Client()
 * registerExactIcpScheme(client, { signer })
 * const fetchWithPayment = wrapFetchWithPayment(fetch, client)
 * ```
 */
export function registerExactIcpScheme(
  client: X402ClientLike,
  opts: { signer: IcpSigner }
): X402ClientLike {
  return client.register('icp:*', new ExactIcpClient(opts.signer))
}

// ─── Convenience: pemToSigner ────────────────────────────────────────────────

/**
 * Convenience function to create a signer from a PEM file path.
 *
 * @example
 * ```typescript
 * import { pemToSigner } from '@canister-software/x402-icp/client'
 *
 * const signer = await pemToSigner('~/.config/dfx/identity/default/identity.pem')
 * ```
 */
export async function pemToSigner(pemPath: string, host?: string): Promise<IcpSigner> {
  const fs = await import('fs')
  const pem = fs.readFileSync(pemPath, 'utf8')
  return createPemSigner({ pem, host })
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function base64urlEncode(bytes: Uint8Array): string {
  const b64 = Buffer.from(bytes).toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
