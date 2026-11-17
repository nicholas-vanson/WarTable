# Crossroads Command — Android test download

## [Download the APK](https://github.com/nicholas-vanson/WarTable/raw/refs/heads/android-test-builds/CrossroadsCommand-0.9.1-test.1.apk)

**0.9.1-test.1 · 79.6 MiB · Android 7.0+ · ARM64 and ARMv7**

Includes the current Global 1940 tabletop, satellite terrain, ocean texture and
stacked paper orders with vertical category tabs.

1. Open the download link in your phone browser while signed in to GitHub.
2. Open the APK from Downloads and tap **Install**. If prompted, enable
   **Allow from this source** for the browser/file manager, then return.
3. Launch **Crossroads Command Test** and choose **Play Global 1940**.

The app runs in landscape. Drag to pan, pinch to zoom, and use the paper tabs
for unit categories. Phones start at **Balanced** quality; choose **Performance**
from the map's **☰** menu if panning is slow.

This test app installs separately from the older Crossroads Command APK and
uses separate saves. Keep it installed for future test updates. It is signed
with a test certificate and is not a Play Store release.

OpenGL ES 3.0 is required. Both common ARM architectures are included in this
single APK; x86-only devices are not included. Phone terrain uses 4K textures
to reduce memory use. The desktop source retains its 8K terrain.

Signature, archive, 16 KB alignment and packaged-resource checks passed, along
with 18 mobile terrain tests, 166 desktop visual checks and gameplay/save/LAN
smoke tests. Installation and performance still need a physical-phone test.

[SHA-256 checksum](SHA256SUMS) · [Build metadata](build-info.json) ·
[Source commit](https://github.com/nicholas-vanson/WarTable/commit/3c847e33440908888b4ae5187d2abfd790631508) ·
[Detailed instructions](https://github.com/nicholas-vanson/WarTable/blob/codex/global-3d-tabletop/docs/ANDROID_TESTING.md)

This branch holds downloadable builds only. Development continues on
`codex/global-3d-tabletop`.
