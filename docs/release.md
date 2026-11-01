# Building releases

Releases are standalone executables with resources embedded using
[`neu build --embed-resources`](https://neutralino.js.org/docs/cli/neu-cli/).
No installer or separate `resources.neu` file is needed.

## Prerequisites

- Node.js and npm
- Neutralino CLI 11.6.0 or newer (`npm install -g @neutralinojs/neu`)
- Project dependencies (`npm ci`)
- Framework binaries in `bin/` (`neu update` on a fresh checkout)

The configured runtime is 6.9.0; embedding requires 6.3.0 or newer.
The community builder and platform installer tools are no longer used.

## Commands

```sh
npm run release
```

This bundles JavaScript and CSS, then builds executables for all supported
platforms and architectures into `dist/setIconEditor/`:

- `setIconEditor-linux_x64`, `setIconEditor-linux_arm64`, `setIconEditor-linux_armhf`
- `setIconEditor-win_x64.exe`
- `setIconEditor-mac_x64`, `setIconEditor-mac_arm64`, `setIconEditor-mac_universal`

Distribute the executable matching the user's operating system and CPU. Each
contains its own resources. Linux still requires the system WebKitGTK runtime
used by Neutralino; normal platform security checks apply.

`npm run release:quick` skips frontend bundling and embeds the existing
`resources/` contents into fresh executables. Rebuild after changing resources;
embedded resources cannot be patched separately.

The former installer target scripts and builder synchronization command have
been removed. Existing installer artifacts in `dist/windows/`, `dist/linux/`,
or `dist/mac/` are old outputs and are not part of the standalone release.

## Verification

Copy the host executable into an otherwise empty directory outside the project
and launch it. Confirm that the editor opens and can open and save an SVG
without a neighboring resources directory or `resources.neu` file.
