const fs = require('fs');
const f = 'frontend/android/app/build.gradle';
let c = fs.readFileSync(f, 'utf8');

const prefix =
  'def keystoreProperties = new Properties()\n' +
  'def keystorePropertiesFile = rootProject.file("key.properties")\n' +
  'if (keystorePropertiesFile.exists()) {\n' +
  '    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))\n' +
  '}\n\n';

c = prefix + c;

c = c.replace(
  /namespace = "([^"]+)"/,
  'namespace = "$1"\n' +
  '    signingConfigs {\n' +
  '        release {\n' +
  '            keyAlias keystoreProperties["keyAlias"]\n' +
  '            keyPassword keystoreProperties["keyPassword"]\n' +
  '            storeFile keystoreProperties["storeFile"] ? file(keystoreProperties["storeFile"]) : null\n' +
  '            storePassword keystoreProperties["storePassword"]\n' +
  '        }\n' +
  '    }'
);

c = c.replace(
  /release \{/,
  'release {\n            signingConfig signingConfigs.release'
);

fs.writeFileSync(f, c);
console.log('Signing config injected into build.gradle');
