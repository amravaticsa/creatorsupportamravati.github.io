import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.creatorsupportamravati.employee',
  appName: 'CSA Employee',
  webDir: 'www',
  server: {
    url: 'https://employee.creatorsupportamravati.in/employee',
    cleartext: false,
    allowNavigation: [
      'employee.creatorsupportamravati.in',
      'creatorsupportamravati.in'
    ]
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#102A43',
      showSpinner: false
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#102A43'
    }
  }
};

export default config;