# CSA Video Editing Android App

This directory contains the Android WebView wrapper for the CSA Video Editing client workflow.

- Application ID: `com.creatorsupportamravati.videoediting`
- Start page: `https://creatorsupportamravati.in/video-editing.html`
- Build command: `gradle assembleDebug`
- Workflow: `.github/workflows/build-csa-video-editing-apk.yml`

The app supports the website file picker for selecting raw media, WebView camera/microphone permissions, download handling, loading progress, and a retry screen for main-page load errors.

This is the client-facing Video Editing app only; it is not the CSA Global employee or admin app.
