import { parseSaveCareRecords } from '../care-wellbeing/daily-care/save-care.input';

const valid = { studentPartyId: 'synthetic-party', meal: { portion: 'HALF', notes: 'synthetic' }, nap: null, hygiene: null, note: '' };
it.each([[], null, [null], [{...valid,health:{}}], [{...valid,meal:{portion:'INVALID'}}], [{...valid,nap:{quality:'DEEP',notes:8}}], [valid,valid]].map(value => ({ value })))('rejects invalid/health/duplicate input %j', ({ value }) => {
  expect(() => parseSaveCareRecords(value)).toThrow('CARE_INVALID_RECORD');
});
it('normalizes only the permitted nonhealth form fields without inferring health or identity', () => {
  expect(parseSaveCareRecords([{ studentPartyId:'synthetic-party', meal:{portion:'HALF'} }])).toEqual([
    {studentPartyId:'synthetic-party',meal:{portion:'HALF',notes:''},nap:null,hygiene:null,note:''},
  ]);
});
