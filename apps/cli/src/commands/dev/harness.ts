/**
 * The preview page `para dev` serves, as source for Vite to compile.
 *
 * These modules are generated rather than shipped as files because they are the
 * project's code, not `para`'s: Vite compiles them with the project's React,
 * they import the project's `@paradoc/react`, and the manifest is written from
 * what discovery found a moment earlier. They are addressed as files of the
 * project root, so every bare import in them resolves out of the project's own
 * `node_modules` exactly as a file there would. Nothing is written to disk.
 *
 * The page itself is the lab's shape, which is the shape the specification asks
 * for: the document paginated on the left, the PDF it renders to on the right.
 * What the lab hard-codes — one document, one data set — is a list here, and
 * where the lab assumes a working composition, this one shows the check's
 * findings in place of the document it could not draw.
 */

import { existsSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'

import type { DiscoveredComposition } from './discovery.js'
import { bindingLabel, messagesFor, sampleLabel } from './messages.js'

/**
 * What the generated modules are named, as files of the project root.
 *
 * They sit at the root rather than in a subdirectory of it because the
 * stylesheet is one of them: Tailwind reads a `@source` path relative to the
 * stylesheet, and a stylesheet whose directory is the root is read the same way
 * whichever end of that relationship a bundler hands it. None of these files
 * exists on disk; the name is an address, not a location.
 */
const HARNESS_PREFIX = 'paradoc-dev.'

/** The generated module ids, as the page imports them. */
export const HARNESS_MODULES = {
	client: `/${HARNESS_PREFIX}client.tsx`,
	manifest: `/${HARNESS_PREFIX}manifest.ts`,
	styles: `/${HARNESS_PREFIX}styles.css`,
	element: `/${HARNESS_PREFIX}element.ts`,
} as const

/** The route the proof view asks for a PDF on. */
export const PDF_ROUTE = '/@paradoc/dev/pdf'

/** The page Vite transforms and serves for every route. */
export function indexHtml(): string {
	return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Paradoc compositions</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${HARNESS_MODULES.client}"></script>
  </body>
</html>
`
}

/**
 * The stylesheet: the document's own, Tailwind compiled against every file a
 * document class can come from, and the preview's own chrome.
 *
 * Two stylesheets in one, deliberately. The document is Tailwind, because that
 * is what an installed composition is written in, and it is compiled
 * from the project's own Tailwind against the project's own files. The page
 * around the document is not: its rules are written out below by hand, so the
 * frame `para dev` draws never depends on the project's Tailwind version, and a
 * project with no Tailwind classes of its own still gets a preview that looks
 * like one.
 *
 * The sources are stated as paths relative to this stylesheet, which is how
 * Tailwind reads `@source` and how the lab's own stylesheet reaches into the
 * project. Without those sources the copied components' classes are never
 * generated, the document lays out shorter than it should, and the PDF receives
 * a page plan measured against the wrong document.
 */
export function stylesheetModule(
	project: string,
	ignored: readonly string[],
): string {
	const root = resolve(project)
	const to = (target: string) => JSON.stringify(posix(relative(root, target)))
	// The same directories discovery refuses to walk. Two lists would let the
	// stylesheet scan a build output discovery never looked at.
	const excluded = ignored.map((name) => `@source not ${to(`${root}/${name}`)};`).join('\n')

	const preset = existsSync(resolve(root, 'styles/paradoc.css'))
		? '@import "./styles/paradoc.css";\n'
		: '@import "tailwindcss";\n'

	return `${preset}

@source ${to(`${root}/**/*.{tsx,jsx}`)};
${excluded}

${CHROME}`
}

/** A path in the POSIX form a stylesheet is written in. */
function posix(path: string): string {
	return sep === '/' ? path : path.split(sep).join('/')
}

/** The preview's own frame. Plain CSS: it is `para dev`'s, not the project's. */
const CHROME = `html,
body,
#root {
  height: 100%;
}

body {
  margin: 0;
  color: #171717;
  background: #f5f5f5;
  font-family: ui-sans-serif, system-ui, sans-serif;
}

.pd-shell {
  display: flex;
  height: 100%;
}

.pd-sidebar {
  display: flex;
  width: 17rem;
  flex-shrink: 0;
  flex-direction: column;
  gap: 0.25rem;
  overflow: auto;
  border-right: 1px solid #d4d4d4;
  background: #fff;
  padding: 0.75rem;
}

.pd-sidebar-heading {
  margin: 0 0 0.25rem;
  padding: 0 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #737373;
}

.pd-item {
  display: block;
  width: 100%;
  cursor: pointer;
  border: 0;
  border-radius: 0.25rem;
  background: transparent;
  padding: 0.375rem 0.5rem;
  text-align: left;
  font: inherit;
  color: #404040;
}

.pd-item:hover {
  background: #f5f5f5;
}

.pd-item[data-selected="true"] {
  background: #171717;
  color: #fff;
}

.pd-item-name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
  font-weight: 500;
}

.pd-item-binding {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.6875rem;
  color: #737373;
}

.pd-item[data-selected="true"] .pd-item-binding {
  color: #a3a3a3;
}

.pd-item[data-composition-problem="true"] .pd-item-name::after {
  content: " !";
  color: #dc2626;
}

.pd-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.pd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  border-bottom: 1px solid #d4d4d4;
  background: #fff;
  padding: 0.75rem 1.5rem;
}

.pd-header-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
}

.pd-header-binding,
.pd-header-meta {
  margin: 0;
  font-size: 0.75rem;
  color: #737373;
}

.pd-split {
  display: flex;
  min-height: 0;
  flex: 1;
}

.pd-preview {
  min-width: 0;
  flex: 1;
  overflow: auto;
}

.pd-proof {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  border-left: 1px solid #d4d4d4;
}

.pd-proof-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid #d4d4d4;
  background: #fff;
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: #404040;
}

.pd-button {
  cursor: pointer;
  border: 1px solid #d4d4d4;
  border-radius: 0.25rem;
  background: #fff;
  padding: 0.25rem 0.75rem;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 500;
  color: #404040;
}

.pd-frame {
  min-height: 0;
  flex: 1;
  border: 0;
  background: #e5e5e5;
}

.pd-note {
  flex: 1;
  margin: 0;
  background: #e5e5e5;
  padding: 1rem;
  font-size: 0.75rem;
  color: #525252;
}

.pd-warning {
  margin: 0;
  border-bottom: 1px solid #fcd34d;
  background: #fffbeb;
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  color: #78350f;
}

.pd-failure {
  margin: 1.5rem;
  border: 1px solid #fca5a5;
  border-radius: 0.25rem;
  background: #fef2f2;
  padding: 1rem;
}

.pd-failure-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #7f1d1d;
}

.pd-failure-list {
  margin: 0.5rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-left: 1rem;
}

.pd-failure-item {
  font-size: 0.75rem;
  white-space: pre-wrap;
  color: #991b1b;
}
`

/**
 * The manifest: what discovery found, with a loader per module.
 *
 * The artifact travels as parsed JSON rather than as an import, because the
 * browser has no artifact parser and the server has already read the file. So
 * do the labels and the failure messages, computed once in Node so the page and
 * the PDF route say the same thing about the same composition. A change to any
 * file discovery read rewrites this module and reloads the page.
 */
export function manifestModule(entries: readonly DiscoveredComposition[]): string {
	const rows = entries.map((entry) => {
		const sample = entry.samples[0]
		const loadSample =
			sample && sample.from === 'sibling'
				? `() => import(${JSON.stringify(`/${sample.relative}`)})`
				: 'null'
		return `  {
    id: ${JSON.stringify(entry.id)},
    relative: ${JSON.stringify(entry.relative)},
    artifact: ${JSON.stringify(entry.artifact?.artifact ?? null)},
    artifactName: ${JSON.stringify(entry.artifact?.name ?? null)},
    binding: ${JSON.stringify(bindingLabel(entry))},
    sample: ${JSON.stringify(sampleLabel(entry))},
    sampleFrom: ${JSON.stringify(sample?.from ?? 'composition')},
    problems: ${JSON.stringify(entry.problems)},
    messages: ${JSON.stringify(messagesFor(entry))},
    load: () => import(${JSON.stringify(`/${entry.relative}`)}),
    loadSample: ${loadSample},
  }`
	})

	return `// Generated by \`para dev\`. Nothing reads this file from disk.
export const entries = [
${rows.join(',\n')}
];
`
}

/**
 * The one line of the render path that has to run in the project's React.
 *
 * The PDF is rendered in Node, so something has to make the element there, and
 * `createElement` has to come from the same React the composition imports. This
 * module sits in the project, so Vite treats `react` in it exactly as it does in
 * a composition: one instance, resolved once.
 */
export function elementModule(): string {
	return `import { createElement } from "react";

export function element(Composition, props) {
  return createElement(Composition, props);
}
`
}

/** The preview application. Generated source, compiled by the project's Vite. */
export function clientModule(): string {
	return CLIENT
}

const CLIENT = `/* Generated by \`para dev\`. */
import { Component, StrictMode, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Pages } from "/components/paradoc/pages.tsx";

import { entries } from "${HARNESS_MODULES.manifest}";
import "${HARNESS_MODULES.styles}";

const PDF_ROUTE = "${PDF_ROUTE}";

/** The composition named in the address bar, so a reload keeps the selection. */
function selectedId() {
  const fromHash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  return entries.some((entry) => entry.id === fromHash) ? fromHash : (entries[0]?.id ?? "");
}

/** The sample the preview renders with, or why there is none. */
function readSample(entry, module, sampleModule) {
  const value =
    entry.sampleFrom === "sibling"
      ? (sampleModule?.default ?? sampleModule?.sample)
      : module?.sample;
  if (value === undefined || value === null) throw new Error(entry.messages.noSample);
  if (typeof value !== "object" || typeof value.fields !== "object" || value.fields === null) {
    throw new Error(entry.messages.badSample);
  }
  return { fields: value.fields, parties: value.parties ?? {} };
}

/** Loads one composition and its sample, reporting rather than throwing. */
function useComposition(entry) {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let live = true;
    setState({ status: "loading" });

    if (!entry) return undefined;
    if (entry.problems.length > 0 || entry.artifact === null) {
      setState({ status: "failed", messages: entry.problems });
      return undefined;
    }

    void (async () => {
      try {
        const module = await entry.load();
        const sampleModule = entry.loadSample ? await entry.loadSample() : null;
        const Composition = module.default;
        if (typeof Composition !== "function") throw new Error(entry.messages.noComponent);
        const data = readSample(entry, module, sampleModule);
        if (live) setState({ status: "ready", Composition, data });
      } catch (error) {
        if (live) setState({ status: "failed", messages: [String(error?.message ?? error)] });
      }
    })();

    return () => {
      live = false;
    };
  }, [entry]);

  return state;
}

/** A comma-joined response header, as a list. */
function names(header) {
  return header === null || header.length === 0 ? [] : header.split(",");
}

/**
 * The PDF for the composition on screen, or the findings that stopped it.
 *
 * Rendered as soon as there is a composition, and again once the preview
 * publishes its page plan, which the second render breaks at. Waiting for the
 * plan would leave the proof view empty for exactly the composition that most
 * needs it: one whose document threw, and so never paginated at all.
 */
function usePdf(entry, plan, nonce) {
  const [state, setState] = useState({ status: "idle" });

  useEffect(() => {
    if (!entry) {
      setState({ status: "idle" });
      return undefined;
    }

    const abort = new AbortController();
    let objectUrl = null;
    setState({ status: "rendering" });

    void (async () => {
      try {
        const response = await fetch(PDF_ROUTE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: entry.id,
            plan: plan ? { breaks: plan.breaks, repeats: plan.repeats } : undefined,
          }),
          signal: abort.signal,
        });

        if (response.status === 422) {
          const body = await response.json();
          setState({ status: "findings", findings: body.findings ?? [] });
          return;
        }
        if (!response.ok) {
          setState({ status: "failed", message: await response.text() });
          return;
        }

        objectUrl = URL.createObjectURL(await response.blob());
        setState({
          status: "ready",
          url: objectUrl,
          // A planned break or header copy the tree no longer carries is
          // dropped by the render and named on the way back. Saying so is the
          // whole point: the page on paper is not the page the plan described.
          unknown: {
            breaks: names(response.headers.get("X-Paradoc-Unknown-Breaks")),
            repeats: names(response.headers.get("X-Paradoc-Unknown-Repeats")),
          },
        });
      } catch (error) {
        if (!abort.signal.aborted) setState({ status: "failed", message: String(error) });
      }
    })();

    return () => {
      abort.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [entry, plan, nonce]);

  return state;
}

/** Anything the document throws while it draws is shown where the document was. */
class PreviewBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { message: null };
  }

  static getDerivedStateFromError(error) {
    return { message: String(error?.message ?? error) };
  }

  componentDidUpdate(previous) {
    if (previous.resetKey !== this.props.resetKey && this.state.message !== null) {
      this.setState({ message: null });
    }
  }

  render() {
    if (this.state.message !== null) {
      return <Failure title="The document could not be drawn" messages={[this.state.message]} />;
    }
    return this.props.children;
  }
}

/** One block of red, wherever the thing it describes should have been. */
function Failure({ title, messages }) {
  return (
    <div data-failure="true" className="pd-failure">
      <p className="pd-failure-title">{title}</p>
      <ul className="pd-failure-list">
        {messages.map((message, index) => (
          <li key={index} className="pd-failure-item">
            {message}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The list of compositions, and which one is on screen. */
function Sidebar({ selected, onSelect }) {
  return (
    <nav data-composition-list="true" className="pd-sidebar">
      <p className="pd-sidebar-heading">
        {entries.length} {entries.length === 1 ? "composition" : "compositions"}
      </p>
      {entries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className="pd-item"
          data-composition-id={entry.id}
          data-selected={entry.id === selected ? "true" : "false"}
          data-composition-problem={entry.problems.length > 0 ? "true" : undefined}
          onClick={() => onSelect(entry.id)}
        >
          <span className="pd-item-name">{entry.relative}</span>
          <span className="pd-item-binding">{entry.binding}</span>
        </button>
      ))}
    </nav>
  );
}

/** The proof view: the PDF the same tree renders to, or what stopped it. */
function Proof({ entry, reason, plan, nonce, onRefresh }) {
  const pdf = usePdf(entry, plan, nonce);
  const status = entry ? pdf.status : "none";
  const unknown = pdf.status === "ready" ? pdf.unknown : { breaks: [], repeats: [] };
  const stale = unknown.breaks.length > 0 || unknown.repeats.length > 0;

  return (
    <aside data-pdf-status={status} className="pd-proof">
      <div className="pd-proof-bar">
        <span>Proof · the PDF, rendered in Node from this tree</span>
        <button type="button" className="pd-button" onClick={onRefresh} disabled={!entry}>
          Refresh
        </button>
      </div>

      {stale ? (
        <p data-unknown-hints="true" className="pd-warning">
          {unknown.breaks.length > 0
            ? "Ignored a page break planned at " + unknown.breaks.join(", ") + ", which this tree no longer carries. "
            : ""}
          {unknown.repeats.length > 0
            ? "Ignored a repeated header planned for " + unknown.repeats.join(", ") + ". "
            : ""}
          The engine paginated from there itself, so the PDF may break where the preview did not.
        </p>
      ) : null}

      {status === "none" ? (
        <p data-no-proof="true" className="pd-note">
          No proof: {reason}
        </p>
      ) : status === "findings" ? (
        <Failure
          title={pdf.findings.length + " " + (pdf.findings.length === 1 ? "problem" : "problems") + " in this composition"}
          messages={pdf.findings.map((finding) => finding.message)}
        />
      ) : status === "failed" ? (
        <Failure title="The PDF could not be rendered" messages={[pdf.message]} />
      ) : status === "ready" ? (
        <iframe key={pdf.url} src={pdf.url} title="Composition PDF" className="pd-frame" />
      ) : (
        <p className="pd-note">Rendering…</p>
      )}
    </aside>
  );
}

function App() {
  const [selected, setSelected] = useState(selectedId);
  // The plan belongs to the composition it was measured from, so the two move
  // together. Clearing it in an effect instead would leave one render in which
  // the new composition is on screen with the old composition's page breaks,
  // and the PDF would be asked for with hints naming keeps it does not have.
  const [plan, setPlan] = useState(null);
  const [nonce, setNonce] = useState(0);

  const choose = useCallback((id) => {
    setSelected(id);
    setPlan(null);
  }, []);

  const entry = useMemo(() => entries.find((each) => each.id === selected), [selected]);
  const composition = useComposition(entry);
  const onPaginate = useCallback((next) => setPlan(next), []);

  useEffect(() => {
    window.location.hash = encodeURIComponent(selected);
  }, [selected]);

  useEffect(() => {
    const onHash = () => choose(selectedId());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [choose]);

  if (entries.length === 0) {
    return (
      <Failure
        title="No compositions found"
        messages={[
          "para dev previews every .tsx or .jsx file under a compositions/ directory. " +
            "Add one, and point an artifact's file layer of MIME type text/tsx at it.",
        ]}
      />
    );
  }

  return (
    <div className="pd-shell">
      <Sidebar selected={selected} onSelect={choose} />

      <div className="pd-main">
        <header className="pd-header">
          <div>
            <h1 className="pd-header-title">{entry ? entry.relative : ""}</h1>
            <p className="pd-header-binding">
              {entry ? (entry.artifactName ?? "unpaired") : ""} · {entry ? entry.sample : ""}
            </p>
          </div>
          <p
            className="pd-header-meta"
            data-page-count={plan ? plan.pages.length : undefined}
            data-page-breaks={plan ? plan.breaks.join(" ") : undefined}
          >
            {plan ? plan.pages.length + (plan.pages.length === 1 ? " page" : " pages") : "Measuring…"}
            {plan && plan.oversize.length > 0
              ? " · " + plan.oversize.map((keep) => keep.id).join(", ") + " overflows a page"
              : ""}
          </p>
        </header>

        <div className="pd-split">
          <main data-preview="true" className="pd-preview">
            {composition.status === "failed" ? (
              <Failure title="This composition cannot be previewed" messages={composition.messages} />
            ) : composition.status === "ready" ? (
              <PreviewBoundary resetKey={entry.id}>
                <Pages onPaginate={onPaginate}>
                  <composition.Composition artifact={entry.artifact} data={composition.data} />
                </Pages>
              </PreviewBoundary>
            ) : (
              <p className="pd-note">Loading…</p>
            )}
          </main>

          <Proof
            entry={composition.status === "ready" ? entry : null}
            reason={
              composition.status === "failed"
                ? composition.messages.join(" ")
                : "the composition has not loaded yet."
            }
            plan={plan}
            nonce={nonce}
            onRefresh={() => setNonce((value) => value + 1)}
          />
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
`
