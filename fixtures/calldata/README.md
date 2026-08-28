# Base Mainnet Calldata Fixtures

`base-mainnet.json` anchors the fixture set to a public Base mainnet transaction
already recorded in `proofs/bc_vwmzy653.json`. The attributed case is the exact
onchain calldata. The missing, wrong-code, and invalid cases are deterministic
derived inputs and are labelled as such; they are not presented as transactions
that were broadcast.

Tests read this snapshot without an RPC request. Keep the transaction hash,
explorer URL, expected Builder Code, and provenance with every future onchain
fixture.
