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

## Release Signing Setup

To produce signed production APKs, configure the following **GitHub Repository Secrets**:

| Secret Name | Description |
|-------------|-------------|
| `ANDROID_KEYSTORE_BASE64` | Your `.jks` keystore file encoded as base64 |
| `ANDROID_KEYSTORE_PASSWORD` | Password for the keystore |
| `ANDROID_KEY_ALIAS` | Key alias (e.g., `ordb`) |
| `ANDROID_KEY_PASSWORD` | Password for the key |

### Generating a Keystore

If you don't have a keystore yet, create one with:

```bash
keytool -genkey -v -keystore release-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias ordb
```

### Encoding the Keystore for GitHub

Convert the keystore to base64 and copy it:

```bash
# macOS
base64 -i release-keystore.jks | pbcopy

# Linux
base64 release-keystore.jks | xclip -selection clipboard
```

Paste the result as the `ANDROID_KEYSTORE_BASE64` secret in **GitHub → Settings → Secrets and variables → Actions**.

> **Security:** Never commit your `.jks` keystore file to the repository. The workflow decodes it from the secret at build time and it only exists on the runner during the build.

## Building a New APK

To trigger a new build manually:

1. Go to **Actions → Build Android APK** on GitHub
2. Click **Run workflow**
3. Choose `debug` (for testing) or `release` (for signed production distribution)
4. Click **Run workflow** — the build takes ~3-5 minutes

> **Note:** Release builds require the signing secrets above to be configured. Debug builds work without them.

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
