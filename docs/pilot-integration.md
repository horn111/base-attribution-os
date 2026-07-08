# Pilot Integration Guide

Base Attribution OS pilots are small attribution-readiness checks for Base
builders. The goal is to prove that Builder Code attribution survives real
transaction paths before deploy.

## Good pilot candidates

- x402 buyer or seller flows that should carry Builder Code extensions.
- viem, wagmi, or ethers app flows that append an ERC-8021 suffix.
- Smart wallet `sendCalls` or batched transaction flows.
- Agent tools that can trigger Base transactions.

## What to provide

Open an integration request with:

- repository or minimal fixture link;
- expected Builder Code, or a placeholder if it cannot be public;
- transaction family: `x402`, `viem`, `wagmi`, `ethers`, `wallet`, or `agent`;
- files or folders where transaction code lives;
- preferred profile: `local`, `ci`, or `strict`.

Do not include private keys, secrets, customer data, or production-only RPC
credentials.

## What BAO checks

- whether candidate transaction paths are detected;
- whether the expected Builder Code or suffix is present when `strict` is used;
- whether official x402 Builder Code helpers stay in buyer or seller paths;
- whether a GitHub Action config can fail a pull request before deploy.

## Pilot output

A useful pilot should produce at least one public artifact:

- fixture repo or PR;
- scanner output showing pass/fail behavior;
- GitHub Action YAML;
- short note describing what attribution regression BAO would catch.

## Near-term pilot targets

- one app or dApp transaction flow;
- one x402 payment flow;
- one wallet or agent flow.
