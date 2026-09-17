import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fightDragons} from './magic.ts';

await test('can battle the dragon', () => {
	assert.equal(fightDragons(), 'Fought the dragon. Dragon vanished. No treasure. Sad.');
});
