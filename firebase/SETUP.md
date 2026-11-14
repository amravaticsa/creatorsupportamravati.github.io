# CSA Firebase setup

The static website remains hosted on GitHub Pages. Firebase is used only for Google sign-in, article likes/comments, and live online-session presence.

## 1. Create the Firebase project
1. Open https://console.firebase.google.com/ and create a project for Creator Support Amravati.
2. Add a Web App in Project settings.
3. Copy the Firebase web configuration into `assets/js/firebase-config.js`. Replace every `PASTE_...` value. The web config is designed to be public; never paste a service-account private key here.

## 2. Enable Google sign-in
1. Open Authentication > Sign-in method.
2. Enable Google and save.
3. In Authentication > Settings > Authorized domains, add `creatorsupportamravati.in` and `www.creatorsupportamravati.in` if the www host is used.

## 3. Create Firestore
1. Open Firestore Database and create a database.
2. Open Rules and publish the contents of `firebase/firestore.rules`.

## 4. Create Realtime Database
1. Open Realtime Database and create a database.
2. Copy its exact Database URL into `databaseURL` in `assets/js/firebase-config.js`.
3. Open Rules and publish the contents of `firebase/database.rules.json`.

## 5. Verify
1. Wait for the GitHub Pages deployment after the config file is committed.
2. Open an article page, confirm the online count changes, sign in with Google, test a Like and post a short test comment.
3. Confirm the same Like/comment appears in a second browser session.

## Data model
- Firestore: `csaArticles/{articleId}/likes/{uid}`
- Firestore: `csaArticles/{articleId}/comments/{commentId}`
- Realtime Database: `presence/{randomSessionId}`

The presence counter represents connected browser sessions and is approximate; it is not a verified count of unique human visitors. Public comments and display names are visible to other visitors. Review the privacy policy before enabling these features.
