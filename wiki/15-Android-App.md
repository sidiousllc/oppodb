# Android App

OppoDB is available as a native Android application built with Capacitor. APKs are generated automatically via GitHub Actions and can be downloaded directly from the repository.

## Download Latest APK

The latest Android APK is built automatically from the `main` branch using GitHub Actions.

**To download:**

1. Go to the [GitHub Actions → Build Android APK](../../actions/workflows/build-android.yml) workflow
2. Click the most recent successful run
3. Scroll to **Artifacts** and download `ordb-debug.apk` (or `ordb-release.apk`)
4. Transfer the APK to your Android device and install it

> **Note:** You may need to enable "Install from unknown sources" in your Android device settings.

## Previous Versions

All previous APK builds are retained as GitHub Actions artifacts for 30 days. To access older versions:

1. Navigate to [Actions → Build Android APK](../../actions/workflows/build-android.yml)
2. Browse the workflow run history
3. Each run includes the APK as a downloadable artifact with the build date

| Version | Build Type | Date | Status |
|---------|-----------|------|--------|
| Latest | Debug / Release | Auto-built on push | ✅ Available via Actions |
| Previous | Debug / Release | See run history | 📦 30-day retention |

## Building a New APK

To trigger a new build manually:

1. Go to **Actions → Build Android APK** on GitHub
2. Click **Run workflow**
3. Choose `debug` (for testing) or `release` (for distribution)
4. Click **Run workflow** — the build takes ~3-5 minutes

## App Details

| Property | Value |
|----------|-------|
| App ID | `app.lovable.ordb` |
| App Name | ORDB |
| Platform | Android (Capacitor) |
| Min SDK | 22 (Android 5.1+) |
| Web Framework | React + Vite + TypeScript |

## Development vs Production

- **Debug builds** connect to the live Lovable preview for hot-reloading during development
- **Release builds** bundle all web assets into the APK for offline-capable, standalone operation

## Installation

### From APK File
1. Download the APK from GitHub Actions artifacts
2. Transfer to your Android device (email, cloud drive, USB)
3. Open the APK file on your device
4. If prompted, allow installation from unknown sources
5. Tap **Install**

### Requirements
- Android 5.1 (Lollipop) or later
- ~50MB free storage
- Internet connection (for data access)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "App not installed" | Enable unknown sources in Settings → Security |
| App crashes on launch | Ensure you're running Android 5.1+ |
| Data not loading | Check internet connection |
| Build fails in Actions | Check the workflow logs for dependency issues |
