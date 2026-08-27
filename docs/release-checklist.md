# Release Checklist

Use this checklist for every public package and GitHub Action release.
Package and project versions follow the [versioning policy](versioning.md).

## Release candidate verification

Run the local package smoke test before publishing:

```bash
pnpm verify:release-candidate
```

The script:

- builds and packs all eight public `@base-attribution-os/*` packages;
- creates a temporary external consumer project;
- wires unpublished internal packages through temporary `pnpm.overrides`;
- installs the packed tarballs;
- runs `bao encode`, `bao check-calldata`, `bao scan-repo`, and `bao doctor`;
- runs the packed GitHub Action bundle with the candidate configuration;
- removes the temporary workspace unless `BAO_KEEP_RELEASE_SMOKE=1` is set.

No tarballs or temporary consumer files should be committed.

Set `BAO_VERBOSE_RELEASE_SMOKE=1` if you need full package-manager output while
debugging a failed smoke run.

## Before the release

- Run `pnpm format`, `pnpm audit --prod`, `pnpm check`, `pnpm build`,
  `pnpm size`, and `pnpm verify:release-candidate`.
- Confirm the committed GitHub Action bundle matches its TypeScript source:
  `git diff --exit-code -- packages/github-action/dist/index.cjs`.
- Confirm npm trusted publishing or `NPM_TOKEN` is configured for every public
  package.
- Verify the Vercel demo production URL still loads.
- Confirm README and workflow snippets use the intended immutable release ref.
- Run `pnpm changeset status` and review every projected package version against
  the approved release brief.
- Confirm the maintainer has recorded validation from at least three external
  or self-owned production apps.

## Release step

Only after an explicit release decision:

- merge the version PR after all required checks pass;
- publish packages and create the immutable GitHub release tag;
- move the floating `v0` tag only after the immutable Action ref passes its
  smoke test;
- confirm `v0^{}` and the immutable release tag resolve to the same commit;
- confirm the final npm and GitHub release links resolve.

## Post-release proof

- Install packages in a fresh external project from npm.
- Run `bao encode`, `bao check-calldata`, `bao scan-repo`, and `bao doctor`.
- Record the result in the GitHub Release notes.
- Share the release post and invite pilot teams to open integration requests.
