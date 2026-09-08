# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Base builders evaluating Builder Code attribution, and visitors following the
Stack the Bag launch on X.

## Product Purpose

Make BAO's attribution work understandable through public, inspectable onchain
evidence. Builders can audit integration code and verify published transactions.

The dashboard must explain BAO's incremental value alongside official Base
analytics: source-path checks, CI regression enforcement, and repeatable onchain
verification. It must not compete on a duplicate set of activity counters or
imply that BAO is required to use Builder Codes. Base App provides automatic
attribution; other clients can use direct SDK integration without BAO.

## Capabilities and Constraints

The docs app uses Next.js and the existing public proof-set registry. Published
proofs are snapshots, not a complete or continuously indexed transaction history.
Stack the Bag uses Builder Code bc_4pe6m33m and will run in seasons. Its currently
published evidence consists of two historical Base Sepolia transactions. A
production deployment and season ingestion are not configured in this repository.
Builder Codes identify projects; they do not identify referring tweets.

## Brand Commitments

Preserve the existing demo site's light surfaces, blue BAO identity, wordmark,
and typography. Use real data, not illustrative activity or invented growth.

## Evidence on Hand

The canonical public manifests live in ../../proofs/sets/. They include BAO on
Base mainnet and Stack the Bag on Base Sepolia. Counts describe only the supplied
evidence and must not imply full-project coverage or verified contract safety.
