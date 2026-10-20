const fs = require('fs');
const vm = require('vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync('MeowScript.js', 'utf8'), context);
const snapshots = vm.runInContext('JSON.stringify(fakeIpFilterSnapshots)', context);
fs.writeFileSync('.meow-config-check/snapshots.json', snapshots);
