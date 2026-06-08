FROM mcr.microsoft.com/devcontainers/javascript-node:22

# shellcheck and shfmt are required by the server test suite.
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends shellcheck shfmt \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Pin pnpm to the version in .tool-versions. A newer pnpm resolves the
# lockfile overrides differently and breaks the frozen install, so install
# this exact version globally (npm-global bin precedes the corepack shim on PATH).
RUN npm install -g pnpm@10.12.1
