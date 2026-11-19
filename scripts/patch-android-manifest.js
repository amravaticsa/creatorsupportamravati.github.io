const fs = require('node:fs');
const path = 'android/app/src/main/AndroidManifest.xml';
let xml = fs.readFileSync(path, 'utf8');
const permissions = [
  'android.permission.INTERNET',
  'android.permission.CAMERA',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION'
];
for (const permission of permissions) {
  const tag = '<uses-permission android:name="' + permission + '" />';
  if (!xml.includes('android:name="' + permission + '"')) {
    xml = xml.replace('<application', '    ' + tag + '\n    <application');
  }
}
fs.writeFileSync(path, xml);
console.log('Android permissions configured:', permissions.join(', '));
