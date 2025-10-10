// Require packages
import {writeFileSync} from 'node:fs';
import {launch} from 'puppeteer';

// Login credentials
const url = 'https://x.com/i/flow/login';
const username = 'rare.lime5456@fastmail.com';
const password = 'euw.rqj6zmh3YUA9yzn';

// Create a login function
const login = async () => {
	// Create a new puppeteer browser
	const browser = await launch({
		// Change to `false` if you want to open the window
		headless: 'new',
	});

	// Create a new browser page
	const page = await browser.newPage();

	// Go to the URL
	await page.goto(url);

	// Input username (selector may need updating)
	await page.type('input[type=text]', username);
	// Input password (selector may need updating)
	await page.type('input[type=password]', password);
	// Click the submit button
	await page.click('button[type=submit]');

	// Wait for a selector to be loaded on the page -
	// this helps make sure the page is fully loaded so you capture all the cookies
	await page.waitForSelector('main');

	const cookies = JSON.stringify(await page.cookies());
	await writeFileSync('./cookies.json', cookies);

	// Optional - sessions & local storage
	// const sessionStorage = await page.evaluate(() => JSON.stringify(sessionStorage));
	// await fs.writeFileSync('./sessionStorage.json', cookies);

	// const localStorage = await page.evaluate(() => JSON.stringify(localStorage));
	// await fs.writeFileSync('./localStorage.json', cookies);

	// Close the browser once you have finished
	browser.close();
};

// Fire the function
await login();
