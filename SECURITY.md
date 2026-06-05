# Security

Base Attribution OS handles transaction calldata and Builder Code metadata. It
does not ask for private keys, seed phrases, or signing permissions.

## Reporting

Please report security issues privately through the repository owner:

https://github.com/horn111

## Scope

In scope:

- incorrect calldata suffix parsing
- false-positive validation results
- GitHub Action command injection risks
- CLI behavior that could leak secrets in logs

Out of scope:

- third-party RPC availability
- Base reward eligibility decisions
- unrelated wallet or app vulnerabilities
