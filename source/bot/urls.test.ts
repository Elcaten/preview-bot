import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
	findFirstSupportedUrl,
	isInstagramUrl,
	isXUrl,
} from './urls.ts';

await test('finds an Instagram URL entity', () => {
	const url = findFirstSupportedUrl([{
		type: 'url',
		text: 'https://www.instagram.com/reel/example/',
	}]);

	assert.equal(url?.toString(), 'https://www.instagram.com/reel/example/');
});

await test('normalizes a URL without a scheme', () => {
	const url = findFirstSupportedUrl([{
		type: 'url',
		text: 'instagram.com/p/example/',
	}]);

	assert.equal(url?.toString(), 'https://instagram.com/p/example/');
});

await test('uses the target of a Telegram text link', () => {
	const url = findFirstSupportedUrl([{
		type: 'text_link',
		text: 'open reel',
		url: 'https://instagram.com/reel/example/',
	}]);

	assert.equal(url?.pathname, '/reel/example/');
});

await test('skips unsupported URLs before a supported URL', () => {
	const url = findFirstSupportedUrl([
		{type: 'url', text: 'https://example.com/'},
		{type: 'url', text: 'https://instagram.com/reel/example/'},
	]);

	assert.equal(url?.hostname, 'instagram.com');
});

await test('accepts Instagram and X subdomains', () => {
	assert.equal(isInstagramUrl(new URL('https://www.instagram.com/reel/example/')), true);
	assert.equal(isXUrl(new URL('https://mobile.x.com/example/status/1')), true);
});

await test('rejects deceptive and malformed hosts', () => {
	assert.equal(isInstagramUrl(new URL('https://evilinstagram.com/reel/example/')), false);
	assert.equal(isInstagramUrl(new URL('https://instagram.com.example.org/reel/example/')), false);
	assert.equal(isInstagramUrl(new URL('ftp://instagram.com/reel/example/')), false);
	assert.equal(isXUrl(new URL('https://notx.com/example/status/1')), false);
	assert.equal(findFirstSupportedUrl([{type: 'url', text: 'not a URL'}]), undefined);
});
