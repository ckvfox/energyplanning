# PROJECT_MASTER

Project: EnergyPlanning
Framework Target: Fox Project Framework v2.1.0
Status: Production
Last Updated: 2026-09-27

## Purpose

EnergyPlanning is a public planning and calculation website for energy-efficiency measures.

## Hosting Profile

- Hosting: Apache-compatible shared hosting (InfinityFree)
- Audit profile: `apache-shared-hosting`
- Live monitoring: Webcheck enabled

## Governance and Security

- The repository baseline, security lifecycle and deployment requirements in `standards/` are binding.
- Secrets remain outside the repository and are never included in deployment packages.
- Webcheck findings are tracked centrally as deduplicated issues in the private Webcheck repository.

## Deployment Compatibility

The established `builds/full-deployment/` and `builds/delta-deployment/` directories remain the local FTP handover paths. They are not committed and may contain only productive payload files.

## Verification

Run the local FPF baseline check, the directly affected tests and a local frontend check before packaging or deployment.
