# 30-second Demo Script

1. Open a Base app transaction helper without a Builder Code.
2. Run `bao scan-repo --path . --builder-code bc_abc123`.
3. Show the missing-attribution finding.
4. Add `builderCodeDataSuffix("bc_abc123")`.
5. Run the scan again.
6. Show the GitHub Action YAML.
7. End on: "Builder Codes should live in CI."
