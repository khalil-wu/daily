import test from 'node:test';
import assert from 'node:assert/strict';
import { unreferencedPhotos } from '../src/services/photoStore';

test('照片文件清理：只删应用自己存的、已经没有任何人在引用的文件', () => {
  const entries = [
    { photos: ['idb:photo/a', 'asset:photo-mountain'] },
    { photos: ['appdoc:photos/b.jpg'] },
  ];
  // a、b 都还有日记在用；c 谁都不用了
  assert.deepEqual(unreferencedPhotos(['idb:photo/a', 'appdoc:photos/b.jpg', 'idb:photo/c'], entries), ['idb:photo/c']);

  // 回收站 / 草稿里的日记也算「还在用」，因为它们的 Entry 同样在列表里
  assert.deepEqual(unreferencedPhotos(['idb:photo/a'], entries), []);

  // 一张照片同时出现在候选列表两次，只清理一次
  assert.deepEqual(unreferencedPhotos(['idb:photo/x', 'idb:photo/x'], entries), ['idb:photo/x']);

  // 空候选直接返回空
  assert.deepEqual(unreferencedPhotos([], entries), []);
});

test('照片文件清理：日记里只剩示例素材时，不会把候选之外的任何东西当孤儿', () => {
  const entries = [{ photos: ['asset:photo-sky'] }];
  assert.deepEqual(unreferencedPhotos(['asset:photo-sky'], entries), []);
});
