import { canonicalDocsUrl, canonicalMarkdownUrl } from "@/lib/canonical-url";
import {
	type Representation,
	negotiateRepresentation,
	parseContentPath,
} from "@/lib/content-negotiation";

const CACHE_CONTROL = "public, max-age=3600, s-maxage=86400";

/** What delivery needs to know about a docs page. */
export interface DeliverablePage {
	url: string;
}

export interface DocsDelivery<Page extends DeliverablePage> {
	/** The published page at these slugs, or undefined when there is none. */
	findPage(slugs: string[]): Page | undefined;
	/** The Markdown document of a page. */
	markdownFor(page: Page): Promise<string>;
	/** Serve the request from static assets, then the app. */
	serve(request: Request): Promise<Response>;
}

function withHeaders(response: Response, headers: Record<string, string>) {
	const next = new Response(response.body, response);
	for (const [name, value] of Object.entries(headers)) {
		if (name === "Vary") {
			const vary = new Set(
				[next.headers.get("Vary"), value]
					.flatMap((entry) => entry?.split(",") ?? [])
					.map((entry) => entry.trim())
					.filter(Boolean),
			);
			next.headers.set("Vary", [...vary].join(", "));
		} else if (name === "Link") {
			next.headers.append("Link", value);
		} else {
			next.headers.set(name, value);
		}
	}
	return next;
}

function markdownLink(page: DeliverablePage): string {
	return `<${canonicalMarkdownUrl(page.url)}>; rel="alternate"; type="text/markdown"`;
}

function body(request: Request, content: string): string | null {
	return request.method === "HEAD" ? null : content;
}

function markdownDocument(
	request: Request,
	content: string,
	status: number,
	headers: Record<string, string>,
): Response {
	return new Response(body(request, content), {
		status,
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			Vary: "Accept",
			...headers,
		},
	});
}

async function pageMarkdown<Page extends DeliverablePage>(
	request: Request,
	delivery: DocsDelivery<Page>,
	page: Page,
): Promise<Response> {
	return markdownDocument(
		request,
		`${await delivery.markdownFor(page)}\n`,
		200,
		{
			"Cache-Control": CACHE_CONTROL,
			Link: `<${canonicalDocsUrl(page.url)}>; rel="canonical"`,
		},
	);
}

function notFound(request: Request): Response {
	return markdownDocument(
		request,
		"# Not found\n\nNo documentation page exists at this URL.\n",
		404,
		{ "Cache-Control": "no-store" },
	);
}

/** The path prefix of the app's server functions, which read no `Accept`. */
const SERVER_FUNCTION_PREFIX = "/_serverFn";

/** An absent resource answers by `Accept`, so caches must key on it. */
function varyOnAbsence(response: Response): Response {
	return response.status === 404
		? withHeaders(response, { Vary: "Accept" })
		: response;
}

/**
 * Serve a request that names no docs page. The app's page routes answer only
 * HTML requests, and fail with a 500 for any other `Accept`. Such a request is
 * asked as HTML, so an absent resource is a 404 rather than a server error.
 */
async function serveOther<Page extends DeliverablePage>(
	request: Request,
	delivery: DocsDelivery<Page>,
	representation: Representation | null,
): Promise<Response> {
	if (representation === "html")
		return varyOnAbsence(await delivery.serve(request));

	const { pathname } = new URL(request.url);
	if (pathname.startsWith(SERVER_FUNCTION_PREFIX))
		return delivery.serve(request);

	const asHtml = new Request(request);
	asHtml.headers.set("Accept", "text/html");
	const response = await delivery.serve(asHtml);
	if (response.status !== 404) return response;
	if (representation === "markdown") return notFound(request);
	return new Response(body(request, "Not found.\n"), {
		status: 404,
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "no-store",
			Vary: "Accept",
		},
	});
}

/**
 * Deliver docs pages in the representation the request names: HTML, or
 * Markdown through an explicit `.md` URL or an `Accept` header. Every other
 * request goes to the assets and the app unchanged.
 */
export function createDocsHandler<Page extends DeliverablePage>(
	delivery: DocsDelivery<Page>,
) {
	return async (request: Request): Promise<Response> => {
		if (request.method !== "GET" && request.method !== "HEAD") {
			return delivery.serve(request);
		}

		const target = parseContentPath(new URL(request.url).pathname);
		const accept = request.headers.get("Accept");
		const representation = negotiateRepresentation(accept);

		if (target?.explicit) {
			const page = delivery.findPage(target.slugs);
			if (!page) return notFound(request);
			return pageMarkdown(request, delivery, page);
		}

		const page = target ? delivery.findPage(target.slugs) : undefined;
		if (!page) return serveOther(request, delivery, representation);

		if (representation === null) {
			return new Response(
				body(
					request,
					"Not acceptable. This page is text/html or text/markdown.\n",
				),
				{
					status: 406,
					headers: {
						"Content-Type": "text/plain; charset=utf-8",
						Vary: "Accept",
					},
				},
			);
		}

		if (representation === "markdown") {
			return pageMarkdown(request, delivery, page);
		}

		return withHeaders(await delivery.serve(request), {
			Vary: "Accept",
			Link: markdownLink(page),
		});
	};
}
