# Android test build

[Download the APK](https://raw.githubusercontent.com/nicholas-vanson/WarTable/android-test-builds/CrossroadsCommand-0.9.1-test.2.apk)
· [Download branch](https://github.com/nicholas-vanson/WarTable/tree/android-test-builds)

Version **0.9.1-test.2**, version code **902**.
App name: **Crossroads Command Test**.
Package: `org.crossroadscommand.cloudtest`.

This update includes the illustrated controls, clean rounded rectangular buttons,
and individually offset/rotated orders sheets with matching tabs. Selecting a
category brings its sheet to the front. It includes the changes reviewed in 1A.7.

Install it over **0.9.1-test.1** to keep this test app's saves. The package ID
and signing certificate are unchanged; there is no need to uninstall first.

The dedicated `android-test-builds` branch contains the installable APK, SHA-256
checksum and build metadata with the exact source commit. Source and build
configuration remain on `codex/global-3d-tabletop`. The APK is not merged into
the source branch. GitHub Releases upload access was unavailable in the cloud
environment, so the repository's download branch provides the file directly.

## Install on a Samsung or another Android phone

1. Sign in to GitHub in your phone browser, then open the APK link above.
   If it opens the file page, use **Download raw file**.
2. Open the APK from Downloads and tap **Install**. If Android asks, permit
   **Allow from this source** for the browser/file manager you are using.
3. Launch **Crossroads Command Test** and choose **Play Global 1940**.
4. Use landscape orientation, drag to pan, pinch to zoom, and tap the paper
   tabs to change purchase categories. The folder can expand or tuck away.

This installs separately from the older `org.crossroadscommand.training` app;
its saves are separate. It uses a new test certificate because the older
certificate was not available in this cloud environment. Future builds signed
with this same key can update this test app. Keep it installed to retain saves.

## Compatibility and verification

- Android 7.0+ (minimum API 24); target API 36.
- ARM64 and ARMv7 in one APK. Covers common current and older ARM phones;
  x86-only devices are not included.
- OpenGL ES 3.0 is required. Landscape, immersive display, and all Android
  screen-size classes are declared. Only the Internet permission is requested.
- Phone terrain uses 4K textures with packed 16-bit elevations. Balanced is
  the initial quality setting; choose Performance from the **gear** menu if panning is slow.
  Desktop keeps 8K textures and its existing quality default.
- This is a release-mode APK signed with a test key, not a Play Store release.
  APK v2/v3 signatures, ZIP alignment and 16 KB ARM64 library alignment pass.
- 18 mobile terrain/projection checks pass both against source resources and
  resources extracted from the APK. The 178 desktop visual checks and gameplay,
  touch-input, save and LAN smoke tests pass.

No physical Android phone or accelerated Android emulator was available here.
Installation, GPU behavior and performance on specific phones still need device
testing. Please report the phone model and Android version with crashes or
display problems, and attach a screenshot when possible.

## Rebuild

Install Godot **4.7.2 Standard** and matching export templates, Java 17 or newer,
Android platform-tools and Android build-tools **36.0.0**. On Linux:

```sh
export GODOT_BIN=/path/to/godot
export JAVA_HOME=/path/to/java
export ANDROID_SDK_ROOT=/path/to/android-sdk
tools/build_android.sh
```

The script creates isolated Godot editor settings, imports the game, exports
the **Android Test** preset, verifies signing/alignment, and writes the APK,
checksum, manifest summary and build metadata under `dist/`. Keep the matching
export templates in Godot's normal data directory (or `XDG_DATA_HOME`).

The signing key defaults to
`${XDG_DATA_HOME:-$HOME/.local/share}/wartable-signing/android-test.keystore`.
Back up this key privately for future updates. Override with
`ANDROID_TEST_KEYSTORE`, `ANDROID_TEST_KEY_ALIAS` and
`ANDROID_TEST_KEYSTORE_PASSWORD` when needed. Keys are excluded from Git and
must not be added to the download branch. The default password is suitable for
a local test key only; use separate protected signing credentials for production.

If terrain changes, first run `python tools/build_mobile_terrain.py` with NumPy
and Pillow installed. Raise `version/code` for each subsequent APK and update
its version name and filename in the Android Test preset and build script.
