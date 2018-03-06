# Releasing

This is mainly a few notes to myself.

To release a new version of the vscode extension

```
vsce publish x.x.x
```

To release a new version of the server

- Bump the version in package.json
- Upload to NPM: `npm publish`
