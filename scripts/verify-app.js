const fs = require('fs');
const pkg = require('../package.json');
const config = fs.readFileSync('capacitor.config.ts', 'utf8');
const shell = fs.readFileSync('www/index.html', 'utf8');
const checks = [
  ['App name', pkg.name === 'csa-employee-mobile'],
  ['Android and iOS Capacitor packages', !!pkg.dependencies['@capacitor/android'] && !!pkg.dependencies['@capacitor/ios']],
  ['Secure portal origin', config.includes('https://employee.creatorsupportamravati.in/employee')],
  ['HTTPS only', config.includes('cleartext: false')],
  ['Mobile app shell', shell.includes('CSA Employee')]
];
for (const [name, ok] of checks) console.log((ok ? 'PASS ' : 'FAIL ') + name);
if (checks.some(([, ok]) => !ok)) process.exit(1);