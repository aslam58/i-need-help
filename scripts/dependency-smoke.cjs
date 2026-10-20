// Exercise the APIs used by dependencies affected by security remediation.
const assert = require('node:assert/strict');
const queryString = require('query-string');
assert.deepEqual({ ...queryString.parse('area=New%20Town&help=tools') }, { area: 'New Town', help: 'tools' });
assert.equal(typeof queryString.parse('area=%E0%A4%A').area, 'string');
const project = require('xcode').project('dependency-smoke.pbxproj');
project.hash = { project: { objects: {} } };
assert.match(project.generateUuid(), /^[A-F0-9]{24}$/);
assert.equal(require('postcss').parse('a { color: green; }').first.selector, 'a');
console.log('Dependency smoke checks passed: URI decoding, xcode UUID, PostCSS.');
