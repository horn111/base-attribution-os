# Attribution Doctor Rules

| Rule     | Default meaning                                   | Typical fix                                      |
| -------- | ------------------------------------------------- | ------------------------------------------------ |
| `BAO001` | Transaction path has no attribution evidence.     | Add `dataSuffix` or an SDK helper.               |
| `BAO002` | A different Builder Code was found.               | Use a code from `bao.config.json`.               |
| `BAO003` | Dynamic attribution cannot be matched statically. | Make the configured code available to strict CI. |
| `BAO004` | Transaction path is ambiguous.                    | Add an explicit supported wrapper or rule.       |
| `BAO005` | Smart-wallet batch lacks `dataSuffix` capability. | Add `capabilities.dataSuffix`.                   |
| `BAO006` | x402 path lacks its Builder Code extension.       | Register or declare the official extension.      |

## Profiles

- `local`: non-protected paths are warnings and do not block work.
- `ci`: missing and wrong attribution are errors; dynamic configuration warns.
- `strict`: every non-protected path is an error.

Rule severity in `bao.config.json` overrides the profile default. Setting a rule
to `off` should be reserved for a documented integration boundary.
