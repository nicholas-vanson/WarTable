# Crossroads Command — Android test download

## [Download the latest APK](https://raw.githubusercontent.com/nicholas-vanson/WarTable/android-test-builds/CrossroadsCommand-0.9.1-test.2.apk)

**0.9.1-test.2 · 83.6 MiB · Android 7.0+ · ARM64 and ARMv7**

Includes the latest Global 1940 visuals: illustrated brass controls, clean
rounded rectangular buttons, and individually offset/rotated orders sheets.
Each tab and its text follow their sheet, and selecting a tab brings that page
to the front. Satellite terrain and the ocean/ownership treatments are included.

**Updating from test.1:** install this APK over the existing **Crossroads Command
Test** app. It uses the same package ID and signing certificate, with version
code increased to 902. Do not uninstall first; keeping the app retains its saves.

1. Open the download link in your phone browser while signed in to GitHub.
2. Open the APK from Downloads and tap **Install** or **Update**. If prompted, enable
   **Allow from this source** for the browser/file manager, then return.
3. Launch **Crossroads Command Test** and choose **Play Global 1940**.

The app runs in landscape. Drag to pan, pinch to zoom, and use the paper tabs
for unit categories. Phones start at **Balanced** quality; choose **Performance**
from the map's **gear** menu if panning is slow.

This test app installs separately from the original `org.crossroadscommand.training`
app. It is signed with a test certificate and is not a Play Store release.

OpenGL ES 3.0 is required. Both common ARM architectures are included in this
single APK; x86-only devices are not included. Phone terrain uses 4K textures
to reduce memory use. The desktop source retains its 8K terrain.

Signature, matching update certificate, archive, ZIP alignment and 16 KB ARM64
library alignment checks passed. Resources extracted from this exact APK passed
18 mobile terrain checks and 25 UI/resource checks, including the new sheet and
button artwork. The source revision also passed 178 desktop visual checks and
gameplay/save/LAN smoke tests. Installation and performance still need a
physical-phone test.

[SHA-256 checksum](SHA256SUMS) · [Build metadata](build-info.json) ·
[Source commit](https://github.com/nicholas-vanson/WarTable/commit/fc87dcb94464bcd880cc0615b3cd062f69e119a3) ·
[Detailed instructions](https://github.com/nicholas-vanson/WarTable/blob/codex/global-3d-tabletop/docs/ANDROID_TESTING.md)

This branch holds downloadable builds only. Development continues on
`codex/global-3d-tabletop`.
