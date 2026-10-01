# 🔎 GEARZ LeakFinder

<p align="center">
  <img src="public/linkfinder.png" alt="GEARZ LeakFinder Theme" width="800">
</p>

GEARZ LeakFinder is an experimental Next.js and TypeScript toolkit for finding potential secret exposures in explicitly authorized sources. It combines a scope editor, source adapters, regex-based detection, and JSONL/SARIF reporting, with optional Hugging Face summaries.

**This is a development prototype.** Several integration and data-handling limitations remain. Read the safety notes below before scanning or sharing output; a zero-result report does not establish that an asset is free of secrets.

## What is in the repository

- **Scope Builder:** edit per-source targets and save them to `scope.yaml`
- **Engine Scan panel:** choose adapters and concurrency, stream CLI logs, and download an export pack
- **Detection engine:** YAML regex rules, entropy and format checks, scoring, caching, and masked previews
- **Reports:** JSONL, SARIF, audit data, result comparisons, and a compliance-file bundle
- **Optional AI summary:** the engine sends selected finding fields to a Hugging Face model
- **Interface:** inline Tutor Mode explanations and dim/sunburst themes

These components are present in source. Their integration is incomplete; see [Current limitations](#current-limitations).

### Source coverage

- **GitHub:** selected text files from repository trees, with repository and file caps
- **Wayback Machine:** text from archived web captures
- **DockerHub:** repository README text
- **npm:** package README text
- **PyPI:** package descriptions or summaries; prefix search is best-effort
- **Additional adapters:** CI/CD URLs, Jenkins, CircleCI, shared Sentry/Crashlytics URLs, DNS AXFR, and local APK/IPA files have separate implementations and configuration requirements

DockerHub does not inspect image layers, and the registry adapters do not unpack package archives. APK/IPA adapters expect local file paths and external tools; entering an application ID in the UI does not download or analyze a mobile app.

## Safety and data handling

- Use only assets and data you own or have explicit, current permission to assess. The included `scope.yaml` contains third-party examples; replace them before use. Their presence is not authorization.
- **JSONL can contain raw secrets.** The engine masks the `preview` field but also stores `evidence.match`, surrounding context, and an ID containing part of the match. The JSONL writer serializes the full finding. Treat output files and export ZIPs as sensitive.
- **Dry run is not a no-network mode.** The UI sends `--dry-run` and `--redact`, but the current CLI does not parse those switches. Do not rely on either control to prevent requests or sanitize exports.
- AI summaries send masked previews, artifact URLs, and metadata to Hugging Face. Review what those fields can contain and obtain any required approval before enabling hosted analysis.
- Keep the app local and trusted-only. The routes can start processes, fetch URLs, write scope files, and export findings without an application authentication layer.

## Local setup

### Requirements

- Node.js and npm compatible with the locked Next.js 15.4.4 release
- A local environment that supports Node.js child processes and writable `scope.yaml`, `data/out/`, and `.cache/`
- Any external tools required by an adapter you choose to investigate

`better-sqlite3` is a native dependency, so installation may need platform build tools if a compatible prebuilt binary is unavailable. Several engine dependencies are declared as development dependencies; do not omit them when preparing the local engine.

### Install and open the interface

```bash
git clone https://github.com/Gearsoldier/gearz-leakfinder.git
cd gearz-leakfinder
npm ci
npm run dev -- --hostname 127.0.0.1
```

Open [http://localhost:3000](http://localhost:3000). Review and replace the supplied scope before selecting any scan action.

### Optional environment variables

- `GITHUB_TOKEN` or `GH_TOKEN`: used by the engine's GitHub adapter; unauthenticated requests are subject to stricter rate limits
- `HF_TOKEN`: required for the engine's hosted Hugging Face summary
- `NEXT_PUBLIC_BASE_URL`: used by the legacy Quick Search route to call the engine endpoint

Provide secrets through the local process environment and keep them out of source control. The standalone CLI does not load a Next.js `.env.local` file itself. Use the minimum access needed for your authorized sources.

The engine summarizer currently implements Hugging Face only, with `openchat/openchat_3.5` as its default model. Provider and model availability must be checked separately. A browser-side Ollama call exists in the incomplete Quick Search flow; it is not an engine summarization option.

## Scope and workflow

The main source adapters accept per-adapter target lists. This empty example makes no claim to third-party authorization:

```yaml
github:
  targets: []
wayback:
  targets: []
dockerhub:
  targets: []
npm:
  targets: []
pypi:
  targets: []
```

Add only specifically authorized targets after reviewing the current integration limitations. Scope matching is a best-effort filter, not an authorization system or network sandbox.

The intended workflow is to save scope, select adapters in **Engine Scan**, inspect live logs, and review local report files before exporting. **Quick Company / Keyword Search** is not a reliable alternative: its company input is not applied to the engine's scope, and the engine response does not provide the result array the page expects.

### Command reference

```bash
# Show CLI usage without starting a scan
npm run scan

# Start the development server locally
npm run dev -- --hostname 127.0.0.1

# Build, then serve the existing build locally
npm run build
npm run start -- --hostname 127.0.0.1
```

`npm run scan -- scan` starts a real scan using the selected scope; the CLI accepts `--adapters`, `--scope`, `--out`, and `--concurrency`. Hosted summarization is requested with `--ai openchat`, optionally with `--ai-model`.

The `scan:demo` script also makes real requests against the bundled scope. Do not run it as an offline demonstration.

Reporting subcommands are invoked through the existing `scan` script, for example `npm run scan -- delta`, `npm run scan -- compliance`, or `npm run scan -- siem-splunk`, with their required arguments. There are no separate `delta`, `export:compliance`, or `siem-splunk` npm scripts. Splunk export sends report data to the configured destination.

## Output files

The engine's default output directory is `data/out/`:

- `findings.jsonl`: full findings, including potentially sensitive raw evidence
- `findings.sarif.json`: SARIF results with masked preview properties
- `summary.md`: generated when hosted summarization runs
- `audit.merkle.json`: audit seal when audit entries exist
- `delta.json` and `drift.csv`: produced by the comparison subcommand
- `compliance/`: produced by the compliance-bundle subcommand

The export endpoint includes whichever of these files are present. Review their contents and timestamps; optional files left by an earlier run can be included.

## Current limitations

- **Scope-filter integration:** the engine passes an artifact string to `inScope`, while the filter expects an object containing artifact or metadata fields. Current runs can therefore discard fetched items and report no findings.
- **CI/CD integration:** the generic CI/CD module has incompatible regex syntax and a different fetch contract from the engine's async-generator contract. The CLI's optional loader can fall back to the CircleCI adapter.
- **Configuration differences:** mobile, telemetry, DNS, and vendor-specific CI adapters use legacy fields that the Scope Builder does not fully represent. Saving through the UI can discard those fields.
- **GitHub coverage:** explicit repository targets assume the `main` branch, and scans are capped and extension-filtered. This is not a full repository-history scan.
- **Status badges:** the page's token and connection indicators are static labels, not live credential checks.
- **Validation:** the repository has no automated test suite or test script. It declares `npm run lint` using `next lint`; build and lint success still need to be established. The supplied commands are not a statement that this checkout passes them.

## Project map

- [`app/`](app/): interface and API routes
- [`engine/cli.ts`](engine/cli.ts): commands and adapter registry
- [`engine/index.ts`](engine/index.ts): detection pipeline
- [`engine/adapters/`](engine/adapters/): source-specific collectors
- [`engine/rules/default.yaml`](engine/rules/default.yaml): built-in detection rules
- [`engine/report/`](engine/report/): report writers
- [`engine/safety/`](engine/safety/): scope filtering, preview masking, and audit helpers

## Roadmap

Ideas from the original project roadmap include user-supplied rule packs, distributed adapter execution, richer Wayback timelines, and report templates for vulnerability-disclosure programs. These are future directions, not completion or delivery commitments.

Made with 🧡 by the GEARZ crew (solo dev, me and a cat 🐈).
