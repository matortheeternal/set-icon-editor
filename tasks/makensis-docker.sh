#!/bin/sh
# makensis-via-docker shim for `neu builder nsis` on hosts without a system
# NSIS install (e.g. no root / package manager has no nsis package).
#
# The @neutralinojs-contrib/builder nsis target shells out to `makensis` on
# PATH. Point PATH at this file under the name `makensis` and it will run
# makensis v3 inside a Debian container with the `nsis` package installed:
#
#   docker build -t seticon-makensis -f tasks/Dockerfile.makensis tasks/
#   mkdir -p ~/.local/bin
#   ln -sf "$PWD/tasks/makensis-docker.sh" ~/.local/bin/makensis
#   export PATH="$HOME/.local/bin:$PATH"
#   neu builder nsis --x64
#
# The invoking working directory is bind-mounted at the same absolute path
# inside the container, so absolute paths in the generated .nsi resolve.
set -eu
IMAGE="${MAKENSIS_DOCKER_IMAGE:-seticon-makensis}"
exec docker run --rm -u "$(id -u):$(id -g)" \
    -v "$PWD:$PWD" -w "$PWD" \
    --entrypoint makensis "$IMAGE" "$@"
