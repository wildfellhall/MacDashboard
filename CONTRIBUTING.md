# Contributing

Thanks for helping improve MacDashboard. Small, focused pull requests are the
easiest to review.

## Development setup

1. Install Node.js 22.9 or newer and npm 10 or newer.
2. Fork and clone the repository.
3. Run `npm ci`.
4. Copy `.env.example` to `.env` only if you need optional provider settings.
5. Run `npm run dev` and open `http://127.0.0.1:4175`.

Never commit `.env`, `.macdashboard`, personal Notes, chat exports, media
history, screenshots containing private data, or credentials. The dashboard's
sample content should remain fictional and non-identifying.

## Before opening a pull request

Run:

```bash
npm run check
npm run test:http
npm audit
```

Describe the user-facing behavior, privacy implications, and testing performed.
Include screenshots for visual changes, using a fresh browser profile with only
the bundled demo data.

## Design and asset policy

MacDashboard is inspired by desktop interaction patterns, but public assets
must be original or available under a compatible open-source license. Do not
commit Apple application icons, logos, screenshots, fonts, or files extracted
from an operating-system bundle. Keep provider attribution visible when adding
external catalog or image sources.

## Security reports

Do not disclose vulnerabilities in a public issue. Follow [SECURITY.md](SECURITY.md).
