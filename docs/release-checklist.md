# v0.1 Release Checklist

Base Attribution OS is in `v0.1` release-candidate mode. This checklist keeps
the first public release mechanical and reviewable.

## Release candidate verification

Run the local package smoke test before publishing:

```bash
pnpm verify:release-candidate
```

The script:

- builds `@base-attribution-os/core`, `@base-attribution-os/scanner`,
  `@base-attribution-os/viem`, and `@base-attribution-os/cli`;
- runs `pnpm pack` for those packages;
- creates a temporary external consumer project;
- wires unpublished internal packages through temporary `pnpm.overrides`;
- installs the packed tarballs;
- runs `bao encode`, `bao check-calldata`, `bao scan-repo`, and `bao doctor`;
- removes the temporary workspace unless `BAO_KEEP_RELEASE_SMOKE=1` is set.

No tarballs or temporary consumer files should be committed.

Set `BAO_VERBOSE_RELEASE_SMOKE=1` if you need full package-manager output while
debugging a failed smoke run.

## Before `v0.1.0`

- Confirm the npm org `@base-attribution-os` is available and owned by the
  maintainer.
- Run `pnpm format`, `pnpm check`, `pnpm build`, and
  `pnpm verify:release-candidate`.
- Verify the Vercel demo production URL still loads.
- Confirm README snippets still say packages are unpublished until release.
- Open or link at least one pilot/integration request.

## Release step

Only after an explicit release decision:

- publish packages as `v0.1.0`;
- create GitHub tags `v0.1.0` and `v0`;
- update GitHub Action snippets from `@main` to `@v0`;
- remove the unpublished-package warning from README;
- add the final npm and GitHub release links to the grant evidence pack.

## Post-release proof

- Install packages in a fresh external project from npm.
- Run `bao encode`, `bao check-calldata`, `bao scan-repo`, and `bao doctor`.
- Record the result in `docs/grant/evidence-pack.md`.
- Share the release post and invite pilot teams to open integration requests.
