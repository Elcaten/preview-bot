import {MenuTemplate} from 'grammy-inline-menu';
import type {MyContext} from '../my-context.ts';
import {menu as settingsMenu} from './settings/index.ts';

function createMenu(): MenuTemplate<MyContext> {
	const menu = new MenuTemplate<MyContext>(ctx =>
		ctx.t('welcome', {name: ctx.from!.first_name}));

	menu.url({
		text: 'Telegram API Documentation',
		url: 'https://core.telegram.org/bots/api',
	});
	menu.url({
		text: 'grammY Documentation',
		url: 'https://grammy.dev/',
	});
	menu.url({
		text: 'Inline Menu Documentation',
		url: 'https://github.com/EdJoPaTo/grammy-inline-menu',
	});

	menu.submenu('settings', settingsMenu, {
		text: ctx => '⚙️' + ctx.t('menu-settings'),
	});

	return menu;
}

export const menu = createMenu();
