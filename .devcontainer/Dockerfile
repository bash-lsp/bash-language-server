FROM mcr.microsoft.com/devcontainers/javascript-node:22

# shellcheck and shfmt are required by the test suite (see .github/workflows/verify.yml).
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends shellcheck shfmt \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Pin pnpm to the version in .tool-versions. The pnpm-10 lockfile is incompatible
# with the pnpm 11 that the base image (or corepack's latest default) provides, so
# install the exact version globally. The repo enforces pnpm via package.json preinstall.
RUN npm install -g pnpm@10.12.1
