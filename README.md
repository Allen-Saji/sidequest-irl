# Sidequest IRL

Good people. Small quests.

[Open Sidequest IRL](https://sidequest-irl-allensajis-projects.vercel.app)

Sidequest gives event attendees a concrete reason to meet: five minutes of pitch feedback, a debugging nudge, a concept explained, or a demo tried. Discover a person, claim their quest, meet using matching tickets, confirm separately, and keep a souvenir.

This is an unofficial Sui Basecamp experiment. Seeded participants are labeled as demos controlled by the builder. Their quest objects and receipts use real Sui testnet transactions.

## Run locally

Requires Node.js 22.13 or newer, npm, and a Supabase PostgreSQL database.

```sh
npm ci
cp .env.example .env.local
# Configure DATABASE_URL and apply the storage migration described below.
npm run dev
```

Open `http://localhost:3100`. For the installable production version:

```sh
npm run build
npm start
```

The public testnet package is preconfigured in `.env.example`. A fresh database starts empty. Connect a compatible Sui wallet, obtain free testnet gas from [the Sui faucet](https://faucet.sui.io/), and join before posting or claiming a quest. Browsing does not require a wallet.

## Mobile PWA

- Responsive phone layout, bottom navigation, safe-area spacing, native form controls, focus management, and reduced motion.
- Web manifest with standalone display, regular and maskable PNG icons, and an Apple touch icon.
- Home-screen installation guidance and the browser install prompt when available.
- Production service worker caches the offline screen, icons, and fonts. It never caches API responses or queues transactions.
- Live profiles, quests, and confirmations require internet. Offline navigation shows a reconnect screen rather than stale actionable state.

Home-screen installation on a physical phone needs an HTTPS host. A laptop's plain HTTP LAN address can preview the layout, but does not provide the installable production experience. Browser wallet behavior on actual iOS and Android devices remains a separate verification step.

## Shared state and ownership

Sui coordinates the creator, helper, claim version, and confirmation state. An opaque random reference links the object to offchain metadata. Display names, asks, profiles, matching codes, and meeting details are not written onchain.

The state machine:

| State     | Allowed changes                                                                    |
| --------- | ---------------------------------------------------------------------------------- |
| Open      | A different wallet can claim; the creator can cancel.                              |
| Claimed   | Each participant can confirm once; the helper can release; the creator can cancel. |
| Completed | Terminal. Both participants confirmed the same claim.                              |
| Canceled  | Terminal. Create a new quest to try again.                                         |

Release clears both confirmations and advances the claim version. A stale request or former helper cannot confirm a new claim. Cancellation is allowed after one confirmation, but never after completion. These checks live in Move, not in the UI or matching code.

The server reads authoritative objects over gRPC, decodes their BCS layout, and mirrors them to Supabase PostgreSQL. Receipt verification races official gRPC and GraphQL reads with bounded timeouts, so either can recover from a transport outage. Object reads must meet the version recorded in the receipt, preventing a lagging indexer from reporting a mutation as synchronized. It verifies transaction success, sender, package, event, object type, event ID, and offchain metadata ownership before attaching a ticket. Submitted transaction digests are retained locally until the server verifies them, allowing recovery after a network interruption.

Offchain writes require a verified wallet signature over a short-lived, single-use, origin-bound challenge. Sessions use an HttpOnly, SameSite cookie with hashed tokens stored server-side. HTTPS origins get Secure cookies. Set `SIDEQUEST_ORIGIN` to the public origin behind a reverse proxy.

## Visibility and storage

Profiles are visible only after explicit opt-in. Anyone with the event URL can browse visible profiles and associated quests. Availability expires after 20 minutes. Hiding a profile removes it and its quests from public discovery; participants can still access their shared quest. Public wallet addresses and transactions remain linkable on testnet.

Supabase PostgreSQL holds profiles, metadata, verified quest snapshots, authentication challenges, sessions, and rate limits in the `sidequest` schema. The backend connects through the session pooler with a restricted `sidequest_app` role and verified TLS. Anonymous and authenticated Supabase API roles cannot access this schema. Chain-version updates, challenge consumption, and rate budgets use atomic database statements.

There is no gas sponsorship, push notification service, account recovery product, or real-world identity verification in this version.

Testnet receipts record mutual attestation, not objective proof that help happened or that it was good.

## Deployment

The frontend runs on Vercel and the API runs on Railway. An external Next.js rewrite forwards `/api/*` to Railway, keeping wallet sessions in first-party, HttpOnly cookies. Railway checks the exact frontend origin on every write. A backend-only `DATABASE_URL` is never sent to Vercel or the browser.

1. Apply `supabase/migrations/20261008000000_sidequest.sql` to your Supabase project, using the dashboard SQL editor or `supabase db query --linked --project-ref YOUR_REF --file "$PWD/supabase/migrations/20261008000000_sidequest.sql"`.
2. Set a strong password and enable login for `sidequest_app` using a secure SQL session. This credential is deliberately absent from the migration. Build its connection string using your project's actual session-pooler hostname, port 5432, and username `sidequest_app.YOUR_REF`.
3. Set Railway variables `DATABASE_URL`, `SIDEQUEST_ORIGIN` (the Vercel production origin), and `NEXT_PUBLIC_SUI_PACKAGE_ID`. Add `DATABASE_CA_CERT` if required for certificate verification. Use the included Dockerfile, one replica, and `/api/health` as the readiness check. No local database disk is needed.
4. Set Vercel production variables `NEXT_PUBLIC_SUI_PACKAGE_ID` and `SIDEQUEST_API_ORIGIN` (the Railway HTTPS origin), then build and deploy. The rewrite destination is read at build time. Do not set `SIDEQUEST_API_ORIGIN` on Railway, which would create a proxy loop.
5. Verify `/api/health`, wallet sign-in, profile persistence after an API restart, and the two-participant claim/confirmation flow through the frontend origin.

Keep credentials in provider environment variables and an ignored local environment file. `SIDEQUEST_ORIGIN` must match the production frontend exactly; preview aliases cannot reuse its origin-bound authentication. The database role has CRUD permission only on Sidequest tables. Authentication uses wallet signatures rather than Supabase Auth.

To migrate an existing local SQLite prototype, configure the Supabase backend environment and run `npm run storage:import -- data/sidequest.sqlite`. The import copies profiles, drafts, and quests; it leaves the source file intact and excludes sessions and signing keys. Use this during initial migration, before accepting new profile edits. Supabase Free can pause inactive projects; its database availability is reflected by `/api/health`.

## Testnet package

- Network: Sui testnet
- Package: `0x230041d6c86b380cbbc9c6ec02c6fc0780da1ed8bad97996b779a55792bdd349`
- Publish transaction: `9urP2ePWF7w2mXJJCyEAvTZmh8VA2johXXYKJkxS4VdQ`
- [Inspect the package](https://suiscan.xyz/testnet/object/0x230041d6c86b380cbbc9c6ec02c6fc0780da1ed8bad97996b779a55792bdd349)

## Verification

```sh
npm run typecheck
npm run build
sui move test --path contracts/sidequest
```

The optional local chain scripts use dedicated testnet keys in `.local/` with restrictive permissions. They never use the CLI's active wallet or mainnet. The deploy script requests faucet gas and publishes through gRPC. The smoke script funds its actors using the dedicated deployer's testnet gas, verifies transitions and a concurrent claim race, and seeds labeled demo profiles and real quest objects into the configured Supabase database.

```sh
npm run chain:deploy
npm run chain:smoke
npm run build
npm start
# In another terminal, while the production server is running:
node --env-file=.env.local node_modules/tsx/dist/cli.mjs --test tests/*.test.ts
npx playwright install chromium
npm run test:e2e
```

Deployment and chain smoke scripts preserve their results and skip an already completed run. The browser tests require those local smoke actors. They use a test-only wallet-standard adapter with keys kept in the Node test process to exercise real testnet transactions through two independent browser sessions. The production app contains no test wallet or automatic signing path.

Set `SIDEQUEST_TEST_URL` to the frontend origin to run API and browser tests against a hosted deployment. Storage tests require the backend `DATABASE_URL`; they check concurrent updates, replay prevention, rate limits, and role permissions. Set `SIDEQUEST_LIVE_CHAIN_TESTS=1` to verify GraphQL receipt recovery with a deliberately failed gRPC reader.

If using an existing Chromium installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable. Screenshots are saved under `.local/screenshots/`. Keep `.local/`, `.env.local`, the database, test traces, and private keys out of source control.

## Source layout

- `src/components/`: mobile interface, forms, sheets, ticket cards, stamp, and wallet interaction.
- `src/app/api/`: profile ownership, challenge authentication, quest metadata, and chain synchronization.
- `src/lib/`: storage, validation, BCS schemas, transaction builders, and gRPC reads.
- `contracts/sidequest/`: Move state machine and role/transition tests.
- `public/`: self-hosted fonts, app icons, service worker, and offline screen.
- `tests/`: API, data validation, and two-session browser tests.

## References

[Sui gRPC SDK](https://sdk.mystenlabs.com/sui/clients/grpc), [Sui dApp Kit](https://sdk.mystenlabs.com/dapp-kit), [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps), [Supabase PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Next.js external rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites).

Fonts are Barlow Condensed and DM Sans, distributed under the SIL Open Font License. License files are included in `public/fonts/`.
