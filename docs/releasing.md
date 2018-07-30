# Releasing

### Client

If the client depends on a specific version of the server, then update `MINIMUM_SERVER_VERSION` in `vscode-client/src/extensions.ts`.

To release a new version of the vscode extension

```
vsce publish x.x.x
```

### Server

To release a new version of the server

- Bump the version in package.json
- Run the script: `./scripts/release-server.sh`
