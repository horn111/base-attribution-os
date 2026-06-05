# Builder Codes Primer

Builder Codes are an attribution layer for Base transactions. A transaction can
carry a suffix that identifies the app, wallet, agent, or builder responsible
for the activity.

Base Attribution OS supports the ERC-8021 suffix shape used by `ox/erc8021`:

```txt
schema 0:
  codes + codesLength + schemaId + 0x80218021802180218021802180218021

schema 1:
  registryData + codes + codesLength + schemaId + 0x80218021802180218021802180218021
```

For multiple Builder Codes, codes are joined with commas before encoding.

```ts
createDataSuffix({ codes: ["baseapp", "morpho"] });
```

Validation should happen in three places:

- while creating transaction requests
- before deployment through CI
- after deployment against real transaction hashes
