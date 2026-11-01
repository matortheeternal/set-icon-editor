#!/bin/sh
set -eu
IMAGE="${MAKENSIS_DOCKER_IMAGE:-seticon-makensis}"
exec docker run --rm -u "$(id -u):$(id -g)" \
    -v "$PWD:$PWD" -w "$PWD" \
    --entrypoint makensis "$IMAGE" "$@"
