#!/usr/bin/env node

/**
 * Script to update package.json with test dependencies and scripts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packagePath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Add test dependencies
if (!packageJson.devDependencies) {
    packageJson.devDependencies = {};
}

const testDeps = {
    'mocha': '^10.2.0',
    'chai': '^4.3.10',
    'sinon': '^17.0.1',
    'express': '^4.18.2',
    'body-parser': '^1.20.2'
};

Object.assign(packageJson.devDependencies, testDeps);

// Add axios as a regular dependency
if (!packageJson.dependencies) {
    packageJson.dependencies = {};
}
packageJson.dependencies.axios = '^1.6.2';

// Add test scripts
if (!packageJson.scripts) {
    packageJson.scripts = {};
}

packageJson.scripts.test = 'mocha test/**/*.test.js --timeout 10000';
packageJson.scripts['test:honeygraph'] = 'mocha test/honeygraph-integration.test.js --timeout 10000';
packageJson.scripts['test:watch'] = 'mocha test/**/*.test.js --watch --timeout 10000';

// Write updated package.json
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

console.log('Updated package.json with test dependencies and scripts');
console.log('Run "npm install" to install the new dependencies');
console.log('Then run "npm test" to execute the test suite');