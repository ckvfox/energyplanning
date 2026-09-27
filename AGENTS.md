# Project Agent Rules

This repository follows Fox Project Framework v2.1.0.

## Mandatory startup sequence

- Read `PROJECT_MASTER.md`, `README.md`, `AGENTS.md`, `TODO.md`, `SECURITY.md` and the task-relevant files in `standards/` before changing code or deployment behavior.
- Run the local FPF baseline check before commit and deployment.
- Record reusable approaches and lessons instead of creating project-specific duplicates.

## Local Toolchain and Setup Check

- Use the repository's local Python environment when available.
- Baseline: `python .github/scripts/fpf_project_compliance.py . --profile apache-shared-hosting --production`.
- Preserve the existing `builds/full-deployment/` and `builds/delta-deployment/` handover paths.

Do not read, open, inspect, summarize, quote, print, or expose secret-bearing files.

Treat at least the following as restricted:
- .env
- .env.local
- .env.*.local
- .secrets
- credentials*
- *.pem
- *.key
- *.pfx
- *.p12
- id_rsa
- id_ed25519
- auth.json

If configuration is needed:
- use `.env.example` when available
- infer variable names from source code
- ask only for missing variable names or formats
- never request or reveal secret values unless the user explicitly asks for secret debugging

Allowed work:
- development
- refactoring
- debugging
- testing
- documentation
- workflow creation

## Production Deployment Packaging

Maintain a dedicated deployment packaging area for productive webserver uploads:
- Use a top-level `builds/` folder.
- Inside it, keep exactly these subfolders:
	- `builds/full-deployment/` for the complete productive upload set.
	- `builds/delta-deployment/` for only the files changed in the latest change set.

Rules for both deployment folders:
- Always clear both folders before preparing a new deployment package.
- Re-populate both folders only with files that are truly hosted productively on the webserver.
- Do not include non-productive repository artifacts (for example READMEs, docs, tests, local scripts, helper notes).
- These folders are intended as FTP upload sources for productive data only.
- Deployment packaging folders must be excluded from Git and must never be pushed to GitHub.

## Strukturharmonisierung

Dieses Repository ist ein Bestandsprojekt. Risikoarme Harmonisierung bedeutet Dokumentation und Inventarisierung.

- `style.css`, `scripts/`, `data/`, `images/` und `builds/` bleiben bestehende Projektpfade.
- Keine Migration nach `assets/` oder `build/deployment/`, solange produktive Referenzen und Deployments davon betroffen sein koennten.
- Neue technische Dokumentation gehoert in `docs/`.
- Abweichungen vom FPF-Zielstandard fuer neue Projekte werden in README oder TODO dokumentiert.

