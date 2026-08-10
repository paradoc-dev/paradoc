import { createFileRoute } from "@tanstack/react-router";

/**
 * Unauthenticated health endpoint for the Cress monitor.
 *
 * The contract is two fields, `status` and `timestamp`, shared by every
 * Paradoc service. It is inlined here rather than imported: this app is part of
 * the public OSS tree and carries no `@paradoc/*` workspace dependency, so the
 * platform's shared contract module is deliberately out of reach. Keep the
 * shape identical if the contract changes.
 *
 * A docs site is statically rendered content with no backing service, so there
 * is nothing to probe. If the worker answers at all it can do its job, and the
 * answer is always `ok`. The monitor previously probed `/` and parsed HTML,
 * which could not distinguish a served page from an error page.
 *
 * It lives under `/api` alongside `api/search`, not at the root: every unmatched
 * root path belongs to the docs content catch-all (`$.tsx`), so a bare `/health`
 * would sit in the same namespace as a page someone could later write.
 */
type HealthReport = {
	status: "ok" | "degraded" | "down";
	timestamp: string;
};

export const Route = createFileRoute("/api/health")({
	server: {
		handlers: {
			GET: () => {
				const body: HealthReport = {
					status: "ok",
					timestamp: new Date().toISOString(),
				};
				return new Response(JSON.stringify(body), {
					headers: {
						"content-type": "application/json; charset=utf-8",
						"cache-control": "no-store",
					},
				});
			},
		},
	},
});
