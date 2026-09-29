declare module "cloudflare:workers" {
  /** The bindings this Worker declares in wrangler.jsonc. */
  export const env: {
    ASSETS?: { fetch(request: Request): Promise<Response> };
  };
}
