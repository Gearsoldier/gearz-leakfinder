# 🔎 GEARZ LeakFinder

<p align="center">
  <img src="https://raw.githubusercontent.com/Gearsoldier/gearz-leakfinder/main/public/linkfinder.png" alt="GEARZ LeakFinder Theme" width="800">
</p>

**Redaction-first OSINT hunting tool** — scan code repos, package registries, Docker images, CI/CD logs, and archived web captures for accidentally leaked secrets.  
Built for bug bounty pros, red teamers, and learners who want to see how real leaks are uncovered (safely, with redaction).

---

## ✨ Features

- **Adapters**: GitHub • Wayback Machine • DockerHub • npm • PyPI • CI/CD logs
- **Scope Builder UI**: point-and-click to define your targets → auto-saves to `scope.yaml`
- **Redaction by default**: sensitive values are masked before logging
- **Tutor Mode**: step-by-step explanations of what’s happening
- **AI Summaries**: results are explained in plain language by local or hosted LLMs
- **Export Pack**: one-click download of JSONL findings, AI summary, and Merkle audit
- **Live Logs**: stream engine output directly in the UI
- **Theme toggle**: dark, dim, or sunburst modes

---

## 🛠️ Setup

1. **Clone and install**
   ```bash
   git clone https://github.com/Gearsoldier/gearz-leakfinder.git
   cd gearz-leakfinder
   npm install
Auth tokens

GitHub: Generate a Personal Access Token (classic, public_repo scope is enough).

Hugging Face: HF_TOKEN for AI summaries.

Export tokens into your shell (add to ~/.bashrc for permanence):

export GITHUB_TOKEN=ghp_xxxxx
export HF_TOKEN=hf_xxxxx
Start UI

npm run dev
Open → http://localhost:3000

🎯 Usage
1. Build your scope
From the UI:

GitHub: orgs, repos, or full repo URLs

Wayback: domains or URLs to pull archived pages

DockerHub: orgs/users or full hub URLs

npm / PyPI: scopes or prefixes (@org, org-*, org*)

CI/CD: artifact or log URLs

APK / IPA: package or bundle IDs

Click Save Scope → writes scope.yaml.

2. Run a scan
In the Engine Scan panel:

Select adapters (e.g., github, wayback, dockerhub)

Toggle Redact secrets ✅

Adjust concurrency (default: 6)

Click Run scan + AI summary

Logs stream live; results are written into ./data/out/.

3. Review results
findings.jsonl → machine-readable findings

findings.sarif.json → import into security dashboards

summary.md → AI-generated analysis for humans

Export everything with one click: Download Export Pack

⚡ Example Scope (Mozilla Bug Bounty)

github:
  targets:
    - "mozilla"
    - "mozilla-mobile"
    - "mozilla-services"
    - "mozilla-releng"
    - "mozilla-iot"

wayback:
  targets:
    - "github.com/mozilla"
    - "hg.mozilla.org"
    - "archive.mozilla.org"

dockerhub:
  targets:
    - "mozilla"

npm:
  targets:
    - "@mozilla"
    - "mozilla-*"

pypi:
  targets:
    - "mozilla*"
📦 Roadmap
Custom regex packs (user-supplied)

Multi-engine federation (run several adapters in parallel clusters)

Timeline mode for Wayback leaks

Export directly to HackerOne / Bugcrowd report templates

Preset scopes for popular programs (Mozilla, Google, etc.)

⚠️ Disclaimer
This tool is for educational and defensive research only.
Use it only on assets that are in-scope and authorized by a bug bounty program or your own organization.
Never target systems you don’t have permission to test.

Made with 🧡 by the GEARZ crew (solo dev, me and a cat 🐈).


