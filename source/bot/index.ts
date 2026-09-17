import {env} from 'node:process';
import {FileAdapter} from '@grammyjs/storage-file';
import dotenv from 'dotenv';
import {Bot, InputFile, session} from 'grammy';
import {MenuMiddleware} from 'grammy-inline-menu';
import {generateUpdateMiddleware} from 'telegraf-middleware-console-time';
import {i18n} from '../translation.ts';
import {configureInstagramDownloader} from './instagram-downloader.ts';
import {handleInstagramUrl} from './instagram-handler.ts';
import {menu} from './menu/index.ts';
import type {MyContext, Session} from './my-context.ts';
import {findFirstSupportedUrl, isInstagramUrl, isXUrl} from './urls.ts';

function requireBotToken(): string {
	const token = env['BOT_TOKEN'];
	if (token === undefined || token === '') {
		throw new Error('You have to provide the bot-token from @BotFather via environment variable (BOT_TOKEN)');
	}

	return token;
}

function createBot(token: string): Bot<MyContext> {
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

	bot.on(['message::url', 'message::text_link'], async ctx => {
		try {
			const url = findFirstSupportedUrl(ctx.entities(['url', 'text_link']));

			if (url && isInstagramUrl(url)) {
				const replyParameters = {
					message_id: ctx.message.message_id,
				};
				await handleInstagramUrl(url, {
					reportError(error) {
						console.error('Error processing Instagram video', error);
					},
					async sendText(text) {
						return ctx.reply(text, {reply_parameters: replyParameters});
					},
					async sendVideo(path) {
						return ctx.replyWithVideo(new InputFile(path), {
							reply_parameters: replyParameters,
							supports_streaming: true,
						});
					},
					async showUploadActivity() {
						return ctx.replyWithChatAction('upload_video');
					},
				});
				return;
			}

			if (url && isXUrl(url)) {
				url.hostname = 'nitter.net';
				return (await ctx.reply(url.toString()));
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

	bot.catch(error => {
		console.error('ERROR on handling update occured', error);
	});

	return bot;
}

let bot: Bot<MyContext> | undefined;
let isStopRequested = false;
let stopPromise: Promise<void> | undefined;

export async function stop(): Promise<void> {
	isStopRequested = true;
	if (!bot?.isRunning()) {
		return;
	}

	stopPromise ??= bot.stop();
	await stopPromise;
}

export async function start(): Promise<void> {
	dotenv.config();
	configureInstagramDownloader();

	bot ??= createBot(requireBotToken());

	// The commands you set here will be shown as /commands like /start or /magic in your telegram client.
	await bot.api.setMyCommands([
		{command: 'start', description: 'open the menu'},
		{command: 'help', description: 'show the help'},
		{command: 'settings', description: 'open the settings'},
	]);

	if (isStopRequested) {
		return;
	}

	await bot.start({
		onStart(botInfo) {
			console.log(new Date(), 'Bot starts as', botInfo.username);
		},
	});
}
