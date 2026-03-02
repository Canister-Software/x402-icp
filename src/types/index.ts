export type {
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
  SettleResponse,
  Network,
  Price,
  AssetAmount,
  SchemeNetworkServer,
} from '@x402/core/types'

// ICP Payload

export interface IcpPayloadAuthorization {
  to: string
  value: string
  expiresAt: number
  nonce: number
}

export interface IcpPayload {
  signature: string
  authorization: IcpPayloadAuthorization
}

// Asset Configuration

export interface AssetConfig {
  symbol: string
  name: string
  decimals: number
  ledgerId: string
  transferFee: number
}

export const ASSETS: Record<string, AssetConfig> = {
  'ryjl3-tyaaa-aaaaa-aaaba-cai': {
    symbol: 'ICP', name: 'Internet Computer',
    decimals: 8, ledgerId: 'ryjl3-tyaaa-aaaaa-aaaba-cai', transferFee: 10_000,
  },
  'xevnm-gaaaa-aaaar-qafnq-cai': {
    symbol: 'ckUSDC', name: 'Chain-key USDC',
    decimals: 6, ledgerId: 'xevnm-gaaaa-aaaar-qafnq-cai', transferFee: 10_000,
  },
  'cngnf-vqaaa-aaaar-qag4q-cai': {
    symbol: 'ckUSDT', name: 'Chain-key USDT',
    decimals: 6, ledgerId: 'cngnf-vqaaa-aaaar-qag4q-cai', transferFee: 10_000,
  },
  // Testnet tokens (faucet.internetcomputer.org)
  'xafvr-biaaa-aaaai-aql5q-cai': {
    symbol: 'TESTICP', name: 'Test ICP',
    decimals: 8, ledgerId: 'xafvr-biaaa-aaaai-aql5q-cai', transferFee: 10_000,
  },
  '3jkp5-oyaaa-aaaaj-azwqa-cai': {
    symbol: 'TICRC1', name: 'Test ICRC-1',
    decimals: 8, ledgerId: '3jkp5-oyaaa-aaaaj-azwqa-cai', transferFee: 10_000,
  },
}