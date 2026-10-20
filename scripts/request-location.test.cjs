const { test } = require('node:test'); const assert = require('node:assert/strict');
const { coarsePoint, withinPilot, PILOT_AREA } = require('../src/features/requests/location.ts');
test('precise GPS rounds to a coarse point before transmission', () => {
 assert.deepEqual(coarsePoint(11.934123,79.831976),{latitude:11.93,longitude:79.83});
 assert.notEqual(coarsePoint(11.934123,79.831976).latitude,11.934123);
});
test('invalid and nonfinite coordinates cannot enter payloads', () => {
 for(const [a,b] of [[91,79],[11,181],[NaN,79],[11,Infinity]]) assert.throws(()=>coarsePoint(a,b));
});
test('manual Puducherry centre works and far-away GPS is rejected', () => {
 assert.equal(withinPilot(PILOT_AREA),true); assert.equal(withinPilot({latitude:13.08,longitude:80.27,label:'Far away'}),false);
});
