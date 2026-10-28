import { describe, expect, it } from 'vitest';
import { normalizeClass, resolveUsername, studentCredentials, teacherUsername } from '../src/credentials';

describe('Classroom credentials', () => {
  it('preserves the required student convention', () => {
    expect(studentCredentials({name: ' Ujjwal   Mishra ', className: 'IX', section: ' B ', rollNumber: '015'}))
      .toEqual({username: 'ujjwal.mishra.9b15', initialPassword: 'ujjwal.9b15', className: '9', section: 'b', rollNumber: '15'});
  });
  it.each(['IX', '9', '9th', 'Class 9'])('normalizes %s', value => expect(normalizeClass(value)).toBe('9'));
  it.each(['', '0', '13', '9xyz'])('rejects invalid class %s', value => expect(() => normalizeClass(value)).toThrow());
  it('preserves Unicode names and normalizes punctuation', () => {
    expect(teacherUsername(' रीना शर्मा ')).toBe('t-रीना.शर्मा');
    expect(teacherUsername('Ujjwal.. Mishra')).toBe('t-ujjwal.mishra');
  });
  it('resolves collisions without replacing existing accounts', () => {
    expect(resolveUsername('t-ujjwal.mishra', new Set(['t-ujjwal.mishra', 't-ujjwal.mishra-2'])))
      .toBe('t-ujjwal.mishra-3');
  });
  it('rejects malformed enrollment values', () => {
    const base = {name: 'Ujjwal Mishra', className: '9', section: 'B', rollNumber: '15'};
    for (const change of [{name: '!!!'}, {section: ''}, {rollNumber: '0'}, {rollNumber: '15x'}]) {
      expect(() => studentCredentials({...base, ...change})).toThrow();
    }
  });
});
