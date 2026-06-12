# Project Agent Rules

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
