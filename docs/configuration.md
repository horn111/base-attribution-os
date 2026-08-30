# Configuration

`bao.config.json` keeps the same attribution policy in local development and CI.

```json
{
  "$schema": "https://raw.githubusercontent.com/horn111/base-attribution-os/main/bao.schema.json",
  "builderCodes": ["bc_abc123"],
  "profile": "ci",
  "include": ["src", "app", "packages"],
  "exclude": ["**/*.test.*", "**/*.spec.*", "**/generated/**"],
  "workspace": {
    "roots": ["apps/*", "packages/*"],
    "tsconfig": ["tsconfig.json", "apps/*/tsconfig.json"]
  },
  "rules": {
    "missing-attribution": "error",
    "wrong-builder-code": "error",
    "dynamic-attribution": "warning",
    "ambiguous-path": "warning"
  }
}
```

## Fields

| Field          | Purpose                                                     |
| -------------- | ----------------------------------------------------------- |
| `builderCodes` | One or more accepted project Builder Codes.                 |
| `profile`      | Default `local`, `ci`, or `strict` policy.                  |
| `include`      | Files or directory prefixes to audit.                       |
| `exclude`      | Glob-like rules removed from the audit.                     |
| `rules`        | Optional severity overrides.                                |
| `baseline`     | Existing findings accepted during incremental rollout.      |
| `workspace`    | Optional workspace roots and tsconfig entrypoint overrides. |

Command-line values override config values. Builder Codes are public project
identifiers and must contain 1-32 lowercase letters, numbers, or underscores.
Private keys, RPC secrets, and wallet credentials never belong in this file.

Attribution Doctor discovers `package.json` workspaces, `pnpm-workspace.yaml`,
and `tsconfig*.json` automatically. An explicitly configured `roots` or
`tsconfig` array replaces discovery for that field. Entries must be relative
to the scan root and cannot escape it. Resolution is limited to repository
source: relative imports, tsconfig aliases, workspace package exports, and
re-export chains are supported; external `node_modules` is not traversed.
