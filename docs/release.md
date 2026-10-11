# Release builds

Windows installers, Debian packages, AppImages and macOS disk images are
built with [`@neutralinojs-contrib/builder`](https://github.com/neutralinojs-community/neutralinojs-builder)
(`neu builder`), driven by the `cli.builder` section in
`neutralino.config.json` and orchestrated by `tasks/release.js`.

## Commands

| Command                | What it does                                              |
| ---------------------- | --------------------------------------------------------- |
| `npm run release`      | Full matrix: `neu build` + every target/arch for the host |
| `npm run release:linux`   | `appimage` + `deb` only                                |
| `npm run release:windows` | `nsis` only                                            |
| `npm run release:mac`     | `dmg` only (macOS hosts)                               |
| `npm run release:quick`   | Same as `release` but reuses existing `dist/` binaries (`--skip-build`) |
| `npm run builder:sync`    | Re-apply the issue-#40 workaround only (see below)     |

Pass-through options for `node tasks/release.js`:

- `--targets=deb,appimage` — build a subset.
- `--skip-build` — skip `npm run build` + `neu build`, reuse `dist/`.
- `--skip-sync` — skip the issue-#40 config sync.
- `--no-rename` — skip the AppImage rename step.
- `--builder-config <path>` (or `NEU_BUILDER_CONFIG`) — override the
  auto-detected installed-builder config path.

## Build matrix (`neutralino.config.json` → `cli.builder`)

| Platform | Target   | Archs                | Output          | Assets (`installerassets/`)                     |
| -------- | -------- | -------------------- | --------------- | ----------------------------------------------- |
| windows  | nsis     | x64                  | `dist/windows`  | `app.ico`, `sidebar.bmp`, `header.bmp`, `LICENSE.txt` |
| linux    | deb      | x64, arm64, armhf    | `dist/linux`    | `app.png` (256px), category/maintainer/description |
| linux    | appimage | x64, arm64           | `dist/linux`    | `app.png` (256px), `LICENSE.txt`                |
| mac      | dmg      | x64, arm64, universal| `dist/mac`      | `app.icns`, `dmg-background.png`, `iconSize`/`window`/icon positions |

Resulting artifacts (v1.0.0 example):

- `dist/windows/Set Icon Editor-setup.exe` (NSIS installer)
- `dist/linux/seticoneditor_1.0.0_{amd64,arm64,armhf}.deb`
- `dist/linux/SetIconEditor-1.0.0-x86_64.AppImage` (+ stable copy `dist/linux/SetIconEditor.AppImage`)
- `dist/mac/SetIconEditor-1.0.0-{x64,arm64,universal}.dmg` (macOS hosts only)

## Known builder quirks handled by `tasks/release.js`

1. **Issue #40 — the builder ignores the project's `neutralino.config.json`.**
   `lib/configresolver.js` reads the config file shipped *inside* the
   installed builder package (`.../@neutralinojs-contrib/builder/neutralino.config.json`),
   so without intervention every build silently uses the builder's example
   app metadata. `tasks/sync-builder-config.js` copies `applicationId`,
   `applicationName`, `version` and the whole `cli.builder` block from the
   project's config into the installed builder's config (keeping a one-time
   `.orig` backup). `tasks/release.js` runs it automatically before every
   build. **Re-run `npm run builder:sync` after reinstalling/updating the
   global `neu` CLI**, which restores the builder's shipped config file.

   The sync script also patches the installed builder's
   `lib/configresolver.js` (one-time `.orig` backup, idempotent) to forward
   the dmg layout keys (`window`, `iconSize`, `appPosition`,
   `applicationsSymlinkPosition`) from the target entry. Upstream
   `resolveConfig()` drops them, so `targets/dmg/packagebuilder.js` crashes
   dereferencing `config.window.width` — i.e. **no dmg build can succeed
   without this patch**. The matching keys live in the `mac/dmg` target entry
   in `neutralino.config.json` (660×400 to match `dmg-background.png`).
   Verified by resolving the `dmg/x64` config and replaying the spec
   construction verbatim (no `TypeError`); the actual `.dmg` still needs a
   macOS host (appdmg/hdiutil).

2. **deb/dmg/nsis builders wipe the output dir.** Each package builder
   deletes every pre-existing `*.deb` / `*.dmg` / `*.exe` in its output
   directory at the start of a build, so multi-arch matrices sharing one
   output dir would keep only the last artifact. `tasks/release.js` parks
   finished artifacts in `dist/.release-hold/` between builds and restores
   them at the end (in a `finally`, so artifacts survive failed runs too).

3. **AppImage filenames need renaming.** The builder emits
   `<appid>-<version>-<arch>.AppImage` (e.g.
   `seticoneditor-1.0.0-x64.AppImage`). `tasks/release.js` renames these to
   `SetIconEditor-<version>-<x86_64|aarch64>.AppImage` and keeps a stable
   `SetIconEditor.AppImage` copy (primary arch) for backwards compatibility
   with the previously published artifact name.

## Host prerequisites

- `neu` CLI + `node` (deb/appimage/nsis all build on a Linux host).
- **nsis** needs a `makensis` binary on `PATH`: Debian/Ubuntu
  (`apt install nsis`), macOS (`brew install nsis`), Windows (NSIS
  installer). Without root/package-manager access, use the containerised
  shim instead:
  `docker build -t seticon-makensis -f tasks/Dockerfile.makensis tasks/`,
  then `ln -s $PWD/tasks/makensis-docker.sh ~/.local/bin/makensis`.
- **dmg** builds only on macOS (`hdiutil`); elsewhere it is skipped.
- **appimage** for an arch other than the host arch is skipped: the
  target arch's `appimagetool` binary cannot execute on a foreign host.
  Cross-arch debs work fine (pure-Node `deboa` packaging).

Suggested CI split: Linux runner → deb (all archs) + AppImage (x64) + nsis;
ARM64 Linux runner → AppImage (arm64); macOS runner → dmg (all archs).

## Testing installers

Static checks (all runnable on the Linux build host, all verified for v1.0.0):

- **deb (amd64)** — genuine install/uninstall round-trip in a container:
  `docker run --rm -v $PWD/dist/linux:/pkgs:ro ubuntu:24.04 bash -c "dpkg -i /pkgs/seticoneditor_1.0.0_amd64.deb && ls /opt/seticoneditor /usr/bin/set-icon-editor && dpkg -r seticoneditor"`.
  Verifies payload lands in `/opt`, the `/usr/bin/set-icon-editor` launcher
  works, and removal is clean. (Launching the GUI needs a desktop/VM.)
- **deb (arm64/armhf)** — payload listing only (foreign arch can't install):
  `ar p <file>.deb data.tar.gz | tar -t` must show
  `opt/seticoneditor/setIconEditor-linux_<arch>` + `usr/bin/set-icon-editor`.
- **AppImage** — extract and inspect:
  `./dist/linux/SetIconEditor.AppImage --appimage-extract && cat squashfs-root/*.desktop`.
  Verifies `AppRun`, the `.desktop` entry (`Name=Set Icon Editor`,
  `Exec=setIconEditor-linux_x64`, `Icon=seticoneditor`) and the icon.
  (Executing it needs FUSE + a display; use a VM for a launch test.)
- **NSIS `.exe`** — archive listing:
  `7z l "dist/windows/Set Icon Editor-setup.exe"` must report `Type = Nsis`
  (`NSIS-3 Unicode`) and contain `setIconEditor-win_x64.exe` + `uninstall.exe`.
  (Running it needs Windows or a VM.)
- **dmg** — macOS only: `hdiutil attach` the image, drag-install to
  `/Applications`, launch, then `spctl -a -vv` the bundle. Note the DMG is
  **unsigned** (the builder has no signing support): on first launch macOS
  Gatekeeper will block it until the user right-click → Open approves it, or
  you `codesign`/notarise it yourself with an Apple Developer ID
  (`codesign --sign "Developer ID Application: …"`, `xcrun notarytool`,
  `xcrun stapler`) as a manual post-step.

Full GUI tests for every artifact need the target OS: a Windows VM (or real
hardware) for the NSIS installer, a Debian/Ubuntu VM for the debs, any distro
with FUSE for the AppImage, and a Mac (or the macOS CI runner) for the dmg.
