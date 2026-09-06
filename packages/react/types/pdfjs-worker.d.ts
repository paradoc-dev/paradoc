/**
 * pdf.js's worker module has no types of its own. It is imported for its side
 * effect alone: loading it registers the worker on the global, which is how
 * pdf.js paints without a worker URL.
 *
 * The declaration lives here rather than beside the source because
 * `paradoc/.gitignore` treats every `.d.ts` under a package's `src` as a build
 * artifact, and this one is source.
 */
declare module "pdfjs-dist/build/pdf.worker.mjs";
