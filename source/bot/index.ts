import {env} from 'node:process';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {FileAdapter} from '@grammyjs/storage-file';
import dotenv from 'dotenv';
import {Bot, InputFile, session} from 'grammy';
import {MenuMiddleware} from 'grammy-inline-menu';
import {generateUpdateMiddleware} from 'telegraf-middleware-console-time';
import {YtDlp} from 'ytdlp-nodejs';
import {i18n} from '../translation.ts';
import {menu} from './menu/index.ts';
import type {MyContext, Session} from './my-context.ts';

dotenv.config();

const binaryPath = env['YTDLP_BINARY_PATH'];
const ffmpegPath = env['FFMPEG_BINARY_PATH'];
const galleryDlPath = env['GALLERY_DL_BINARY_PATH'];

if (!galleryDlPath) {
	throw new Error('You have to provide the gallery-dl binary path via environment variable (GALLERY_DL_BINARY_PATH)');
}

const ytdlp = new YtDlp({
	binaryPath,
	ffmpegPath,
});

const token = env['BOT_TOKEN'];
if (!token) {
	throw new Error('You have to provide the bot-token from @BotFather via environment variable (BOT_TOKEN)');
}

const bot = new Bot<MyContext>(token);

bot.use(session({
	initial: (): Session => ({}),
	storage: new FileAdapter(),
}));

bot.use(i18n.middleware());

if (env['NODE_ENV'] !== 'production') {
	// Show what telegram updates (messages, button clicks, ...) are happening (only in development)
	bot.use(generateUpdateMiddleware());
}

bot.on('message::url', async ctx => {
	try {
		const urlList = ctx.message.text?.split(' ').map(x => {
			try {
				return new URL(x);
			} catch {
				return undefined;
			}
		}).filter(Boolean);
		const url = new URL(urlList?.[0] ?? '');

		if (url.hostname.endsWith('instagram.com')) {
			url.hostname = 'kkinstagram.com';
			return (await ctx.reply(url.toString()));
		}

		if (url.hostname.endsWith('x.com')) {
			const execFileAsync = promisify(execFile);
			const dlGalleryResult = await execFileAsync(galleryDlPath, ['-g', url.toString()]);

			if (dlGalleryResult.stderr) {
				throw new Error(dlGalleryResult.stderr);
			}

			return await ctx.reply(dlGalleryResult.stdout);
		}

		if (url.hostname.endsWith('youtube.com')) {
			const videoFile = await ytdlp.getFileAsync(url.toString());
			const result = await ctx.replyWithVideo(new InputFile(videoFile.stream()));
			return result;
		}

		return await ctx.reply('Unsupported URL');
	} catch (error) {
		console.error('Error on handling update occured', error);
		return ctx.reply('Something went wrong');
	}
});

bot.command('help', async ctx => ctx.reply(ctx.t('help')));

const menuMiddleware = new MenuMiddleware('/', menu);
bot.command('start', async ctx => menuMiddleware.replyToContext(ctx));
bot.command('settings', async ctx =>
	menuMiddleware.replyToContext(ctx, '/settings/'));
bot.use(menuMiddleware.middleware());

// False positive as bot is not a promise
// eslint-disable-next-line unicorn/prefer-top-level-await
bot.catch(error => {
	console.error('ERROR on handling update occured', error);
});

export async function start(): Promise<void> {
	// The commands you set here will be shown as /commands like /start or /magic in your telegram client.
	await bot.api.setMyCommands([
		{command: 'start', description: 'open the menu'},
		{command: 'help', description: 'show the help'},
		{command: 'settings', description: 'open the settings'},
	]);

	await bot.start({
		onStart(botInfo) {
			console.log(new Date(), 'Bot starts as', botInfo.username);
		},
	});
}
