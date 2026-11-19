# CSA Employee — Mobile App

Cross-platform native shell for the existing Creator Support Amravati Employee Portal.

## Architecture
- Android and iOS app IDs: `in.creatorsupportamravati.employee`
- App name: CSA Employee
- Capacitor 8 native container (Android API 36 target).
- Existing Cloudflare Worker + D1 + R2 employee services remain the source of truth.
- Employee portal: https://admin.creatorsupportamravati.in/employee
- HTTPS only; no backend credentials are embedded in the app.

## Existing portal capabilities reused
Employee Code/password login, password recovery, check-in/check-out, GPS + selfie evidence, office/field mode, attendance history, leave requests, work updates and media uploads.

## Build
```sh
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```
For iOS on macOS:
```sh
npx cap add ios
npx cap sync ios
npx cap open ios
```

## Store release requirements
- Google Play Console developer registration and signed Android App Bundle.
- Apple Developer Program membership, App Store Connect app record, signing certificate and provisioning profile.
- Public privacy policy and store listing metadata.
- Permission disclosures for camera, location and employee attendance evidence.
- Store review and testing on real devices.

The included CI Android workflow creates a debug APK for internal testing. A debug APK is not a Play Store release. iOS CI validates the native project; an App Store IPA requires Apple signing credentials and provisioning.
