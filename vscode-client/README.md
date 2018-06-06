# Bash IDE

Bash language server. Uses [Tree Sitter][tree-sitter] and its
[grammar for Bash][tree-sitter-bash] with [explainshell][explainshell] integration.

## System Requirements

You need to install that language server separately as it depends on native node
modules.

```bash
npm i -g bash-language-server
```

## Features

- [x] Jump to declaration
- [x] Find references
- [x] Code Outline & Show Symbols
- [x] Highlight occurrences
- [x] Code completion
- [x] Simple diagnostics reporting
- [x] Documentation for flags on hover
- [ ] Rename symbol

## Configuration

To get documentation for flags on hover (thanks to explainshell), run the [explainshell Docker container][codeintel-bash-with-explainshell]:

```
docker run --rm --name bash-explainshell -p 5000:5000 chrismwendt/codeintel-bash-with-explainshell
```

And add this to your VS Code settings:

```
    "bashIde.explainshellEndpoint": "http://localhost:5000",
```

It defaults to `""`, which disables explainshell integration. When set, this extension will send requests to the endpoint and displays documentation for flags.

Once https://github.com/idank/explainshell/pull/125 is merged in, you'll be able to set this to `"https://explainshell.com"`.

[tree-sitter]: https://github.com/tree-sitter/tree-sitter
[tree-sitter-bash]: https://github.com/tree-sitter/tree-sitter-bash
[explainshell]: https://explainshell.com/
[codeintel-bash-with-explainshell]: https://hub.docker.com/r/chrismwendt/codeintel-bash-with-explainshell/
