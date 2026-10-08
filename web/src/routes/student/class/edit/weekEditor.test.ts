import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clashes, type Slot } from './WeekEditor.tsx';

const s = (weekday: number, start: string, end: string): Slot => ({ subjectId: 'x', subjectName: 'X', weekday, start, end, room: '' });
test('clash = same day + overlap; touching is fine', () => {
  assert.ok(clashes(s(1, '09:00', '10:00'), s(1, '09:30', '10:30')));
  assert.ok(!clashes(s(1, '09:00', '10:00'), s(1, '10:00', '11:00')));
  assert.ok(!clashes(s(1, '09:00', '10:00'), s(2, '09:00', '10:00')));
});
