# @canister-software/x402-icp

[x402](https://x402.org) payment scheme for the [Internet Computer](https://internetcomputer.org) — brings native ICP token payments (ICP, ckUSDC, ckUSDT) to the HTTP 402 standard using ICRC-2 approve/transferFrom.

## Overview

x402 is an open protocol for machine-native HTTP payments. This library adds ICP support to the x402 ecosystem, letting any HTTP resource accept ICP tokens with a single line of middleware — and any client pay automatically using an internet identity.

**Supported assets**

| Symbol | Asset |
|--------|---------|
| ICP | `icp:1:ryjl3-tyaaa-aaaaa-aaaba-cai` |
| ckUSDC | `icp:1:xevnm-gaaaa-aaaar-qafnq-cai` |
| ckUSDT | `icp:1:cngnf-vqaaa-aaaar-qag4q-cai` |

`icp:1` signifisy the network as 

## Installation

```bash
npm install @canister-software/x402-icp
```

Requires `@x402/core >= 2.4.0` as a peer dependency.

## Usage

### Client — paying for a resource

```typescript
import { x402Client } from '@x402/core/client'
import { wrapFetchWithPayment } from '@x402/fetch'
import { registerExactIcpScheme, createPemSigner } from '@canister-software/x402-icp/client'
import fs from 'fs'

const signer = await createPemSigner({
  pem: fs.readFileSync('identity.pem', 'utf8'),
})

const client = new x402Client()
registerExactIcpScheme(client, { signer })

const fetch402 = wrapFetchWithPayment(fetch, client)
const res = await fetch402('https://api.example.com/premium')
```

### Server — protecting a resource

```typescript
import { createIcpPaymentRequirements } from '@canister-software/x402-icp/server'

const requirements = createIcpPaymentRequirements({
  network: 'icp:1:xevnm-gaaaa-aaaar-qafnq-cai', // ckUSDC
  amount: '1000000',                              // 1 ckUSDC (6 decimals)
  payTo: 'your-principal-id',
})
```

## Facilitator

A public facilitator for ICP is operated by Canister Software at:

``` 
https://facilitator.consensus.canister.software
```

Full documentation: [docs.canister.software](https://docs.canister.software)

## License

MIT
