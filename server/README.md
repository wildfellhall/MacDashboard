# MacDashboard assistant service

This local-only service binds to `127.0.0.1:4176`, validates all browser input,
and returns only allowlisted dashboard action suggestions. Its preferred
Messages provider is the authenticated local Codex CLI, used through
`@openai/codex-sdk`.

Provider selection at server startup is:

1. Codex when `codex login status` confirms an authenticated session.
2. The OpenAI Responses API when Codex is unavailable and `OPENAI_API_KEY` is
   configured.
3. The deterministic local assistant when neither generative provider is ready.

Once Codex is selected, a failed Codex turn returns a provider error without
executing deterministic local actions and without routing the same content to
the API-key provider.

Environment:

- `CODEX_PATH`: optional path to the Codex executable; defaults to `codex`.
- `CODEX_MODEL`: optional Codex model override; otherwise the authenticated
  account default is used.
- `OPENAI_API_KEY`: enables OpenAI Responses API calls. Without it, the service
  can still use authenticated Codex or, if neither is available, the
  deterministic local fallback.
- `OPENAI_MODEL`: optional model override; defaults to `gpt-5.6-sol`.
- `OPENAI_SAFETY_IDENTIFIER`: optional local stable seed. The server hashes it
  before use. If omitted, a private per-install identifier is generated locally.
- `API_PORT`: optional port override; defaults to `4176`.
- `DASHBOARD_ORIGINS`: comma-separated browser origins allowed to call the
  service; defaults to the dashboard on port `4175`.
- `TMDB_READ_ACCESS_TOKEN`: optional server-side TMDB API Read Access Token.
  When set, TV discovery adds regional movie and series streaming availability
  powered by JustWatch. The token is never returned to the browser.
- `TMDB_REGION`: optional two-letter availability region; defaults to `US`.

### Codex thread and sandbox

Codex runs with `sandboxMode: "read-only"`, network access disabled, web search
disabled, and `approvalPolicy: "never"`. Its working directory is the
MacDashboard project, but ordinary conversation is expected to use the supplied
dashboard context rather than inspect files. This Messages surface cannot edit
the workspace or expand its permissions.

The service stores only the current thread ID pointer at
`.macdashboard/codex-thread-id`, with owner-only directory/file permissions.
After a successful first turn, subsequent server processes resume that thread.
`POST /api/codex/thread/reset` is available only while Codex is the active
provider. It clears the in-memory thread and local pointer; the next message
starts a new thread. It does not delete the previous thread from the underlying
Codex account. The Messages conversation-info panel exposes this as a
confirmation-protected **New Codex Conversation** control.

Explicit image attachments are written temporarily under
`.macdashboard/codex-attachments`, supplied to the bounded Codex turn, and
removed in the turn cleanup path.

### OpenAI API-key fallback

When Codex is not authenticated and `OPENAI_API_KEY` is present, the server uses
the OpenAI Responses API instead. The key stays server-side. Requests use
`store: false`, which disables stored
response objects but is not a claim of zero API abuse-monitoring retention. It
accepts text plus an explicitly selected JPEG, PNG, WebP, or GIF up to 2 MB;
  declared formats must match file signatures and bounded dimensions. Profile,
  note metadata (including only whether a sketch exists), a current
  passage-level taste dossier, up to four locally retrieved query-relevant Note
  excerpts, bounded review/reading-history metadata, and current recommendation
  descriptions plus evidence summaries are included only when the browser
  sends them. Dossier evidence is capped at 80 passages of 360 characters at
  the server boundary; every passage must reference Note metadata supplied in
  the same request, and the declared coverage must match those current Notes.
  Query-retrieved excerpts are capped at 600 characters. Full Note bodies are
  present only in the
  user-authorized Notes Ask flow or after one-request consent in Messages. A
  sketch is rendered locally to a bounded PNG and follows the same explicit
  authorization boundary.

Actions can open apps, navigate/search them, focus only a supplied
recommendation ID, select only a supplied note ID, or stage a grounded
Books/Photos/TV library change. Preference, ordinary note-edit, new-note, and
library mutations remain reviewed suggestions: the host applies the exact
change only after the user accepts it. Generic note edits cannot target the
special Preferences note; that note uses the stricter structured preference
patch path.

Generative-provider failures do not masquerade as a successful connection or
drop into local behavior.
Authentication, rate-limit, timeout, refusal, incomplete-output,
malformed-output, and provider availability states produce an explicit error
while preserving the selected provider. No model action is used from an
incomplete or invalid response.

`POST /api/recommendations/plan` is the generative planning boundary for Books
and TV. It validates the same current Note metadata and bounded taste dossier,
plus explicit search text, known/anchor/dismissed/history titles. Codex uses a
fresh non-persistent structured turn so an earlier favorite or deleted Note
cannot leak into the next slate. The planner must propose real exact-title
catalog lookups, combine multiple taste dimensions, rotate Note evidence, cap
same-creator repetition, exclude dismissed titles, and avoid more than two
obvious neighbors of one anchor. The OpenAI API-key provider implements the
same strict schema with `store: false`. If AI planning does not complete, the
route returns `503`; it never emits deterministic search seeds, and the browser
keeps the existing recommendation slate unchanged.

`GET /api/discover/photos?q=...` is a separate, explicit non-AI discovery
route. After a user action it fans out concurrently to Openverse, Wikimedia
Commons, the Art Institute of Chicago’s public-domain IIIF collection, and The
Met Open Access collection. Results are interleaved so one provider cannot
crowd out the others. It requests bounded image metadata, maps HTTPS
image/source URLs, retains creator and license provenance, identifies itself
to each service, isolates provider failures, and caches results for 15 minutes.
The bundled photo catalog remains available when every web source is offline.

`GET /api/discover/books?q=...` is the equivalent explicit discovery route for
Open Library. It requests bounded catalog fields, keeps HTTPS cover and work
links, identifies the dashboard, and caches each query for 15 minutes. Query
terms are not copied into subjects, themes, or descriptions. AI-planned
discovery calls this route with exact title-plus-author searches and drops
unverified proposed works. The bundled book catalog remains available when
Open Library is offline.

`GET /api/discover/tv?q=...` runs only after a user action. It searches Apple
for movies and seasons and TVmaze for cross-platform series, maps TVmaze
web-channel/network names, preserves official and attribution links, and
isolates source failures so one working catalog can still return results.
Exact title matches are ranked ahead of loose provider results, Apple season
names are normalized to their show title, and query words are not stamped onto
candidate mood metadata. The AI planner uses TVmaze for title/alias
verification rather than sending it thematic preference phrases.
Apple matches include a JustWatch comparison link; TVmaze data is identified as
CC BY-SA.

When `TMDB_READ_ACCESS_TOKEN` is set, the same bounded search adds TMDB movie
and series details plus subscription, free, ad-supported, rental, and purchase
availability for `TMDB_REGION`. Availability is attributed to JustWatch and
links through TMDB’s regional watch page. The browser receives configuration
status, never the token. The UI includes the approved TMDB mark and required
non-endorsement notice whenever TMDB data is present. Queries are cached for
30 minutes; the bundled TV catalog remains available when every web source is
offline.

Required runtime packages: `express`, `@openai/codex-sdk`, and `openai`.
