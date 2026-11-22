import assert from 'node:assert/strict';
import test from 'node:test';
import { groupByPlace } from '../src/utils/places';
import { actions } from '../src/store/store';

const entry = (id: string, place: { name: string; latitude?: number; longitude?: number }, extra = {}) => actions.newEntry({ id, place, status: 'published', ...extra });
test('place groups keep all journals and average only complete valid coordinates', () => {
  const groups = groupByPlace([
    entry('one', { name: ' 杭州 ', latitude: 30, longitude: 120 }, { createdAt: 10 }),
    entry('two', { name: '杭州', latitude: 32, longitude: 122 }, { createdAt: 20 }),
    entry('partial', { name: '杭州', latitude: 40 }),
    entry('invalid', { name: '杭州', latitude: 100, longitude: 120 }),
    entry('manual', { name: '小书店' }),
  ]);
  assert.equal(groups[0].count, 4);
  assert.equal(groups[0].locatedCount, 2);
  assert.equal(groups[0].lat, 31);
  assert.equal(groups[0].lng, 121);
  assert.equal(groups[1].lat, undefined);
  assert.equal(groups[1].locatedCount, 0);
});
test('place groups exclude hidden, deleted and draft entries', () => {
  const place = { name: '私密地点', latitude: 30, longitude: 120 };
  assert.deepEqual(groupByPlace([
    entry('hidden', place, { hidden: true }),
    entry('deleted', place, { deletedAt: 1 }),
    entry('draft', place, { status: 'draft' }),
  ]), []);
});
