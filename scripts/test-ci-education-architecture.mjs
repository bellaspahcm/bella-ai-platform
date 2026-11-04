import assert from 'node:assert/strict';

function compareBaseline(baseline, current) {
  const added = [];
  const reduced = [];
  const signatures = new Set([...Object.keys(baseline), ...Object.keys(current)]);

  for (const signature of [...signatures].sort()) {
    const baselineCount = baseline[signature] ?? 0;
    const currentCount = current[signature] ?? 0;
    const delta = currentCount - baselineCount;

    if (delta > 0) {
      added.push({ signature, baselineCount, currentCount, delta });
    } else if (delta < 0) {
      reduced.push({ signature, baselineCount, currentCount, delta });
    }
  }

  return {
    status: added.length > 0 ? 'BLOCK' : 'ALLOW',
    added,
    reduced,
  };
}

const reviewed = {
  "scheduling/repositories/preschool-scheduling.repository.ts:L42 - Direct database query targeting '.from('edu_' is prohibited in the Product layer.": 1,
};

const same = compareBaseline(reviewed, reviewed);
assert.equal(same.status, 'ALLOW');
assert.equal(same.added.length, 0);
console.log('PASS EDUCATION ARCH SAME BASELINE = ALLOW');

const withNewViolation = {
  ...reviewed,
  "learning-development/new-risk.service.ts:L10 - Direct database query targeting '.from('edu_' is prohibited in the Product layer.": 1,
};
const added = compareBaseline(reviewed, withNewViolation);
assert.equal(added.status, 'BLOCK');
assert.equal(added.added.length, 1);
console.log('PASS EDUCATION ARCH NEW VIOLATION = BLOCK');

const reduced = compareBaseline(reviewed, {});
assert.equal(reduced.status, 'ALLOW');
assert.equal(reduced.reduced.length, 1);
console.log('PASS EDUCATION ARCH DEBT REDUCTION = ALLOW');
