# Versioning and Release Trains

Base Attribution OS uses project release trains and independently versioned npm
packages.

## Project releases

Repository tags such as `v0.2.0` name a tested project release. A project
release includes the documentation, examples, GitHub Action, and the set of npm
package versions published together.

The project release version does not require every npm package to carry the
same version. Release notes must list the package versions included in the
train.

## Package versions

Maintainers use Changesets to assign each public package version from its API
and behavior changes:

- `patch` fixes behavior without expanding the public contract;
- `minor` adds capability or changes a pre-1.0 public contract;
- `major` is reserved for the future stable compatibility policy.

Internal dependency updates follow the repository Changesets configuration.
Before a version PR, run `pnpm changeset status` and review every projected
version. Add or amend Changesets when the projection does not match the release
scope.

## GitHub Action refs

Immutable tags such as `v0.2.0` identify the Action bundle tested for that
release. The floating `v0` tag points to the latest compatible, verified v0
Action release.

Move `v0` only after the immutable tag passes the packed Action smoke test.
Confirm both tags resolve to the same commit before announcing the release.

## Release boundary

Before feature implementation, approve a release brief that fixes the project
release version, package change types, compatibility requirements, and product
gates. Keep the version PR limited to package versions, changelogs, and
lockfiles. Review product behavior in feature PRs.
