'use strict';

const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const CONFIG_FILES = ['Config/MeowConfig.yaml', 'Config/MeowConfigLite.yaml'];

function loadConfig(file) {
  const source = fs.readFileSync(path.resolve(__dirname, '..', '..', file), 'utf8');
  const document = YAML.parseDocument(source, { merge: true, uniqueKeys: true });
  if (document.errors.length) throw new Error(`${file}: ${document.errors.map((error) => error.message).join('; ')}`);
  return document.toJS({ maxAliasCount: 1000 });
}

module.exports = { CONFIG_FILES, loadConfig };
