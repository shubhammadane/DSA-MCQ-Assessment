import test from 'node:test';
import assert from 'node:assert/strict';
import { AnswerQueue } from '../src/services/answerQueue.ts';

test('a new selection waits for the in-flight answer before saving', async () => {
  const batches: unknown[] = [];
  let release: () => void = () => {};
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const queue = new AnswerQueue(async answers => {
    batches.push(answers);
    if (batches.length === 1) await blocked;
  }, () => {});
  queue.set(1, 'A');
  const saving = queue.flush();
  queue.set(1, 'B');
  assert.equal(queue.flush(), saving);
  assert.equal(batches.length, 1);
  release();
  await saving;
  assert.deepEqual(batches, [
    [{ question_number: 1, selected_answer: 'A' }],
    [{ question_number: 1, selected_answer: 'B' }],
  ]);
});

test('failed answers retry without overwriting a more recent selection', async () => {
  const batches: unknown[] = [];
  const states: string[] = [];
  let reject: (error: Error) => void = () => {};
  const blocked = new Promise<void>((_, fail) => { reject = fail; });
  const queue = new AnswerQueue(async answers => {
    batches.push(answers);
    if (batches.length === 1) await blocked;
  }, state => states.push(state));
  queue.set(1, 'A');
  queue.set(2, 'C');
  const saving = queue.flush();
  queue.set(1, 'B');
  reject(new Error('offline'));
  await assert.rejects(saving, /offline/);
  assert.equal(states.at(-1), 'offline');
  await queue.flush();
  assert.deepEqual(batches[1], [
    { question_number: 1, selected_answer: 'B' },
    { question_number: 2, selected_answer: 'C' },
  ]);
  assert.equal(states.at(-1), 'saved');
});
