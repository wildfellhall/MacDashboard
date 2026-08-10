# Security policy

## Supported versions

Security fixes are applied to the latest commit on `main`.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository when it
is available. If that option is unavailable, contact the repository owner
privately through their GitHub profile. Do not include credentials, private
Notes, chat exports, photographs, or media-history files in a public issue.

Include the affected route or component, impact, reproduction steps using
non-sensitive sample data, and any suggested mitigation. You should receive an
acknowledgement within seven days.

## Deployment boundary

MacDashboard is designed as a local application. The assistant service rejects
non-loopback clients and must remain bound to `127.0.0.1`. Do not expose it
directly to the internet or deploy it as a shared multi-user service without a
separate authentication, authorization, storage, and threat-model review.

Keep real values only in the ignored `.env` file. Local Codex thread pointers
and installation identifiers belong in the ignored `.macdashboard` directory.
Browser Notes, Messages, libraries, and personalization data live in local
storage and should be treated as private, device-local data.
