# Android App

OppoDB is available as a native Android application built with Capacitor. APKs can be **auto-built on demand** from inside the web app, or downloaded from GitHub Actions artifacts. Every install requires a per-user **serial key** that is bound to a single device on first launch.

## Auto-Build APK from the Web App

The Android documentation page in the web app includes an **"Auto-Build Android App"** panel that triggers a build remotely:

1. Open **Documentation → Android App** in the web app
2. Scroll to the **Auto-Build Android App** panel
3. Pick **Debug** (unsigned, fastest) or **Release** (signed) and **APK** or **AAB**
4. Click **Build Now** — the panel calls the `dispatch-android-build` edge function which fires the GitHub Actions `build-android.yml` workflow
5. Refresh the panel after ~3–5 minutes; the recent-runs list links straight to the GitHub Actions page where the APK artifact can be downloaded

> Auto-build requires two project secrets configured by an admin: `GITHUB_TOKEN` (with `workflow` scope) and `GITHUB_REPO` (in `owner/repo` form). Until those are set the panel shows a configuration notice and a direct link to the Actions page where builds can still be run manually.

## Serial Keys & Device Binding

The Android app is gated by a per-user license key managed in **Profile → 📱 Android**:

| Action | Behavior |
|--------|----------|
| **Generate Random Serial** | Creates a 25-char `XXXXX-XXXXX-XXXXX-XXXXX-XXXXX` key (32-char alphabet, no I/O/0/1) |
| **Set Custom Serial** | Save your own memorable serial (A–Z, 0–9, dashes; 6–128 chars). Must be globally unique. |
| **Regenerate** | Issues a new serial value, invalidates the old one, and unbinds the device |
| **Unbind** | Frees the device binding so the same serial can be re-used on a new device |
| **Revoke / Reactivate** | Disables or re-enables a serial without changing its value |
| **Delete** | Permanently removes the serial |

On first launch the Android app prompts for the serial, sends it to the public `validate-serial` edge function with the device's `ANDROID_ID`, and on success stores it locally and binds it to the device. Subsequent launches re-validate silently. A revoked or device-mismatched serial blocks the WebView and re-prompts.

## App Details

| Property | Value |
|----------|-------|
| App ID | `app.lovable.ordb` |
| App Name | ORDB |
| Platform | Android (Capacitor) |
| Min SDK | 24 (Android 7.0+) |
| Web Framework | React + Vite + TypeScript |

## Requirements

- Android 7.0 or later
- Internet connection
- A valid serial key from your account
