# Working on Bash Language Server

## Setup and commands

- Run commands from the repository root unless a command says otherwise.
- Use Node from `.nvmrc` (`nvm use`) and the pnpm version in `package.json`.
  Treat these files as the source of truth for versions.
- Install dependencies with `pnpm install --frozen-lockfile`. The root postinstall
  also installs the VS Code client's dependencies.
- Have `shellcheck` and `shfmt` on PATH for integration tests. CI tests both the
  distro and latest shfmt versions; formatter output can differ by version.
- See [the development guide](docs/development-guide.md) for editor debugging and
  [the release guide](docs/releasing.md) for publishing workflows.

## Repository map

| Area | Location and responsibility |
| --- | --- |
| LSP server | `server/src/server.ts`: request handlers, document events, configuration, diagnostics |
| Analysis | `server/src/analyser.ts`: parsed documents, symbol lookup, sourcing, background analysis |
| Parser | `server/src/parser.ts`: loads the bundled `server/tree-sitter-bash.wasm` |
| Shell semantics | `server/src/util/`: declaration, scope, sourcing, syntax-tree and LSP helpers |
| External tools | `server/src/shellcheck/` and `server/src/shfmt/` |
| Configuration | `server/src/config.ts`; VS Code settings in `vscode-client/package.json` |
| VS Code extension | `vscode-client/src/`: client lifecycle and server startup |
| Test support | `testing/fixtures/`, `testing/fixtures.ts`, `testing/mocks.ts`; tests beside code in `__tests__/` |

## Validation

- During development, run the relevant Vitest file or test name. For example:

  ```sh
  pnpm test server/src/__tests__/input-declarations.test.ts
  pnpm test server/src/__tests__/server.test.ts -t 'rename'
  ```

- For code or dependency changes, run `pnpm verify:bail` before handoff. This is
  the CI entry point: lint without autofix, compile both packages, and tests with
  coverage. Report any checks that could not run and why.
- `pnpm compile` also copies `get-options.sh` into the server output; use it when
  validating the build rather than invoking TypeScript alone.
- `pnpm lint` and `pnpm verify` apply autofixes. Use `pnpm lint:bail` for a lint
  check that does not rewrite source files.
- For documentation-only changes, check the diff, referenced paths and commands;
  the full code test suite is unnecessary.
- Review snapshot changes for intended behavior; do not accept updates merely
  to make tests pass. Reuse `updateSnapshotUris` for snapshots containing repo paths.

## Implementing changes

- Keep changes to `docs/development-guide.md` minimal: update it only when setup,
  commands, or development workflows change. Put dependency upgrade notes and
  implementation details in the PR description instead.
- Keep shell semantics in the existing analysis and utility layers. Reuse shared
  declaration and sourcing helpers instead of adding separate interpretations in
  individual LSP handlers.
- For a behavior bug, reduce it to a small shell example and add a regression test
  that fails before the fix. Inspect the actual tree-sitter output when syntax
  shape matters, including incomplete input encountered while editing.
- When changing symbol semantics, check the affected completion, hover,
  definition, references, rename and document-symbol consumers. Cover supported
  input and nearby unsupported cases so analysis does not invent declarations.
  [Input declaration tests](server/src/__tests__/input-declarations.test.ts) show
  how to exercise several consumers with the same example.
- Preserve explicit WASM tree ownership: free replaced or abandoned trees, keep
  the previous cached document on analysis failure, and do not retain nodes from
  freed trees. See [tree lifecycle tests](server/src/__tests__/analyzer-lifecycle.test.ts).
- Preserve cancellation and freshness across edits, document closure,
  configuration changes and shutdown. Stale work must not publish diagnostics or
  overwrite newer analysis; keep background discovery and subprocess work bounded.
  See [background lifecycle tests](server/src/__tests__/background-lifecycle.test.ts)
  and [ShellCheck lifecycle tests](server/src/shellcheck/__tests__/lifecycle.test.ts).
- For public settings, keep the server schema, VS Code setting definitions,
  configuration tests and relevant README documentation consistent.
- The client installs separately from the root/server workspace. Update its own
  `package.json` and `pnpm-lock.yaml` when changing its dependencies or bundled
  server version. Follow the development guide for npm/pnpm override alignment.
- Use `scripts/upgrade-tree-sitter.sh` for grammar updates. Keep generated build
  output (`server/out/`, `vscode-client/out/`) out of source changes.

## Code Review Rules

- Review the requested diff and enough surrounding code to establish its effects.
  Prioritize correctness, regressions and resource lifecycle issues, then
  maintainability. Leave formatting and import ordering to the existing tooling.
- Give each finding a concrete location, consequence and actionable remedy.
  Distinguish blocking defects from optional improvements; a review may have no
  findings when the evidence supports that result.
- Look for duplicated semantics, misplaced responsibilities and abstractions
  that add indirection without simplifying the implementation. Prefer changes
  that remove complexity while preserving the required behavior.
- Treat file size and added conditionals as prompts to investigate cohesion, not
  automatic failures. Bash syntax can require legitimate special cases; explain
  which behavior a proposed simplification preserves and how it will be tested.
- Keep fixes focused on the requested behavior. Suggest broader restructuring
  separately unless it is necessary for the change; reserve a full structural
  audit for an explicitly requested deep review.
