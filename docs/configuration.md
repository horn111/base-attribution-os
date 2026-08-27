# Configuration

`bao.config.json` keeps the same attribution policy in local development and CI.

```json
{
  "$schema": "https://raw.githubusercontent.com/horn111/base-attribution-os/main/bao.schema.json",
  "builderCodes": ["bc_abc123"],
  "profile": "ci",
  "include": ["src", "app", "packages"],
  "exclude": ["**/*.test.*", "**/*.spec.*", "**/generated/**"],
  "rules": {
    "missing-attribution": "error",
    "wrong-builder-code": "error",
    "dynamic-attribution": "warning",
    "ambiguous-path": "warning"
  }
}
```

## Fields

| Field          | Purpose                                                |
| -------------- | ------------------------------------------------------ |
| `builderCodes` | One or more accepted project Builder Codes.            |
| `profile`      | Default `local`, `ci`, or `strict` policy.             |
| `include`      | Files or directory prefixes to audit.                  |
| `exclude`      | Glob-like rules removed from the audit.                |
| `rules`        | Optional severity overrides.                           |
| `baseline`     | Existing findings accepted during incremental rollout. |

Command-line values override config values. Builder Codes are public project
identifiers and must contain 1-32 lowercase letters, numbers, or underscores.
Private keys, RPC secrets, and wallet credentials never belong in this file.
