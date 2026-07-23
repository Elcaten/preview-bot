export type UrlEntity = {
	type: 'url';
	text: string;
} | {
	type: 'text_link';
	text: string;
	url: string;
};

function parseUrl(value: string): URL | undefined {
	try {
		return new URL(value);
	} catch {
		try {
			return new URL(`https://${value}`);
		} catch {
			return undefined;
		}
	}
}

function hasHostname(url: URL, hostname: string): boolean {
	const normalizedHostname = url.hostname.toLowerCase().replace(/\.$/, '');
	const isWebUrl = url.protocol === 'http:' || url.protocol === 'https:';
	return isWebUrl
		&& (normalizedHostname === hostname || normalizedHostname.endsWith(`.${hostname}`));
}

export function isInstagramUrl(url: URL): boolean {
	return hasHostname(url, 'instagram.com');
}

export function isXUrl(url: URL): boolean {
	return hasHostname(url, 'x.com');
}

export function findFirstSupportedUrl(entities: readonly UrlEntity[]): URL | undefined {
	for (const entity of entities) {
		const value = entity.type === 'text_link' ? entity.url : entity.text;
		const url = parseUrl(value);
		if (url && (isInstagramUrl(url) || isXUrl(url))) {
			return url;
		}
	}

	return undefined;
}
