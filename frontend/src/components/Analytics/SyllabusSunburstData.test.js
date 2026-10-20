import test from 'node:test';
import assert from 'node:assert/strict';
import { getMasteryColor, DEFAULT_SYLLABUS } from './SyllabusSunburstData.js';

test('getMasteryColor returns valid rgb gradient strings', () => {
  const red = getMasteryColor(0);
  assert(red.startsWith('rgb(239,'), '0% mastery should be red');

  const amber = getMasteryColor(50);
  assert(amber.startsWith('rgb(245,'), '50% mastery should be amber');

  const emerald = getMasteryColor(100);
  assert(emerald.startsWith('rgb(16,'), '100% mastery should be emerald');

  // Edge cases (negative or >100 clamped)
  assert.equal(getMasteryColor(-10), red);
  assert.equal(getMasteryColor(150), emerald);
});

test('DEFAULT_SYLLABUS contains multi-tiered hierarchy with weightage and mastery', () => {
  assert(Array.isArray(DEFAULT_SYLLABUS));
  assert(DEFAULT_SYLLABUS.length >= 3, 'Must have at least 3 subjects');

  for (const subject of DEFAULT_SYLLABUS) {
    assert(subject.id, 'Subject must have id');
    assert(subject.name, 'Subject must have name');
    assert(subject.weightage > 0, 'Subject must have positive weightage');
    assert(subject.children && subject.children.length > 0, 'Subject must have chapters');

    for (const chapter of subject.children) {
      assert(chapter.id, 'Chapter must have id');
      assert(chapter.name, 'Chapter must have name');
      assert(chapter.children && chapter.children.length > 0, 'Chapter must have subtopics');

      for (const topic of chapter.children) {
        assert(topic.id, 'Topic must have id');
        assert(topic.name, 'Topic must have name');
        assert(typeof topic.mastery === 'number', 'Topic must have numerical mastery');
        assert(topic.pyqFrequency, 'Topic must have historical PYQ frequency');
      }
    }
  }
});
