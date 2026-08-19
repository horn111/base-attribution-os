# Onchain Proof

Status: verified on Base mainnet.

Base Attribution OS has a registered Builder Code for its own proof
transaction:

```txt
bc_vwmzy653
```

The project uses this transaction to prove its own workflow: Builder Code
attribution should be visible, testable, and easy to verify before deploy.

Do not use this Builder Code in your app. It exists only for BAO's own onchain
proof. Replace examples with your own Builder Code from Base.

## Proof transaction

| Field        | Value                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| Builder Code | `bc_vwmzy653`                                                                                          |
| Network      | Base mainnet                                                                                           |
| Transaction  | `0x6573344cfb346c886806804fb8f8b6cc510c30d7974a1a69c11452a5f8fe4926`                                   |
| Explorer     | [Basescan](https://basescan.org/tx/0x6573344cfb346c886806804fb8f8b6cc510c30d7974a1a69c11452a5f8fe4926) |
| Verified by  | `bao check-tx`                                                                                         |

## Create the suffix

Generate the ERC-8021 suffix with the published CLI:

```bash
pnpm dlx @base-attribution-os/cli@0.1.0 encode --code bc_vwmzy653
```

## Send the transaction

Send a small Base mainnet transaction from the project or maintainer wallet and
append the generated suffix as transaction calldata.

Do not commit private keys, seed phrases, RPC secrets, or wallet config to this
repository.

## Verify the transaction

After the transaction is mined:

```bash
pnpm dlx @base-attribution-os/cli@0.1.0 check-tx \
  --hash 0x6573344cfb346c886806804fb8f8b6cc510c30d7974a1a69c11452a5f8fe4926 \
  --rpc-url https://mainnet.base.org \
  --expect bc_vwmzy653
```

Expected result: `bao` confirms that the transaction calldata contains the
expected Builder Code attribution suffix.

Verified output:

```txt
Attribution OK: bc_vwmzy653
```

You can also cross-check the same transaction in the
[Builder Code Validation](https://builder-code-checker.vercel.app/) tool linked
from Base docs. That checker is useful after a transaction exists. BAO is useful
before deploy and again here as a CLI proof.

## Proof scope

This focused proof shows that BAO can use its own CLI to verify a real Base
transaction attributed with its own Builder Code. It does not require a custom
contract deployment.
