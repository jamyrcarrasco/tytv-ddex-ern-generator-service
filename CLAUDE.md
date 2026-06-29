# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server with hot-reload (ts-node-dev)
npm run build     # Compile TypeScript to dist/
npm run start     # Run compiled output
npm run lint      # Run ESLint over src/**/*.ts
npm run format    # Format with Prettier
```

There is no test suite.

## Environment Setup

Copy `example.env` to `.env`. `API_KEYS` is **comma-separated** (e.g. `KEY1,KEY2`) — the middleware splits on commas and validates against all values.

## Architecture

This is a single-endpoint Express microservice. The request flow is:

```
POST /api/ddex/generate
  → apiKeyAuth middleware (x-api-key header)
  → ddexRoutes.ts  (validates releaseId, generatorType, UPC, ISRC, date, duration, sound_url)
  → releaseRepository.ts  (3 sequential DB queries: release + tracks + track artists)
  → ddexGenerator.ts OR AudioSalad_ddexGenerator.ts
  → returns application/xml
```

**Generator types** (`generatorType` request body field):
- `standard` — uses absolute URLs in `<URI>` elements (default)
- `audiosalad` — uses relative S3 paths in `<FileName>` elements for AudioSalad bucket scanning

**Repository pattern**: `getReleaseWithDetails` runs three queries and assembles the result — `releases` JOIN `labels`/`release_types`/`users`, then `release_tracks` JOIN `music_genders`/`languages`, then `release_track_artists` JOIN `users`/`roles`. All DB column aliases (e.g. `sound_path as sound_url`, `artist_name as stage_name`) are defined in the SQL, not in application code.

**XML generation**: Built with `xmlbuilder2` using a fluent builder pattern. The DDEX ERN 3.8.2 output has four sections: `MessageHeader`, `ResourceList` (one `SoundRecording` per track + optional `Image`), `ReleaseList`, `DealList` (5 hardcoded deal types covering worldwide streaming/download/clips), and `ReleaseRelationships` (only for multi-track releases).

## Key Mapping Tables (`src/types/ddex.ts`)

- `ROLE_TO_DDEX_MAP` — maps Spanish/English role names from the DB to DDEX standard roles (e.g. `'Artista' → 'MainArtist'`)
- `EXPLICIT_STATUS_MAP` — maps `explicit`/`clean`/`edited` to DDEX `ParentalWarningType`
- `MIX_VERSION_MAP` — maps version strings like `remix`/`live` to DDEX `VersionType`

## DDEX Compliance Notes

- Any changes to XML structure must validate against the [DDEX ERN 3.8.2 spec](https://ddex.net/standards/ern/382/).
- `sound_length` is stored as `MM:SS` or `HH:MM:SS` in the DB; `convertToIsoDuration()` in `ddexGenerator.ts` normalizes it to ISO 8601 (`PT3M45S`).
- The sender `PartyId` (`PADPIDA2014071501Y`) and recipient `PartyId` (`PADPIDA2013011301U`) in `MessageHeader` are hardcoded DDEX party identifiers.

## AudioSalad Ingestion — S3 File Naming

For `generatorType: audiosalad`, files are uploaded to `{S3_INGEST_BUCKET}/{S3_INGEST_BASE_PATH}/{UPC}/`:

| File | Naming convention |
|---|---|
| Audio tracks | `{UPC}_1_{trackNumber}.{ext}` (e.g. `730734944249_1_1.wav`) |
| Cover image | `{UPC}.{ext}` (e.g. `730734944249.jpg`) |
| DDEX XML | `{UPC}.xml` |
| Handshake | `delivery.complete` (empty file; triggers AudioSalad scan) |

The `1` in audio filenames is the disc number (hardcoded; all releases are single-disc).

---

## Production Readiness Checklist

This service is not yet production-ready. Below is everything that must be done before consuming it from the main TranKYouTV backend in production.

### Priority 1 — Required before go-live

**[x] DELETE endpoint for S3 cleanup**
`DELETE /api/ddex/ingestion/:upc` — lists and batch-deletes all files under `{basePath}/{UPC}/`. Returns `200 { deleted[] }`, `404` if folder was empty, `400` if UPC missing. Implemented in `s3Service.deleteReleaseFromS3` + `ddexRoutes`.

**[ ] Ingestion tracking table in the main backend DB**
The main TranKYouTV backend must persist the result of every upload to support fallbacks, re-ingestion, and auditing. Suggested schema:

```sql
CREATE TABLE release_ingestions (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  release_id      INT NOT NULL,
  upc             VARCHAR(20) NOT NULL,
  distributor     VARCHAR(50) NOT NULL DEFAULT 'audiosalad',
  s3_bucket       VARCHAR(100),
  s3_path         VARCHAR(200),
  files           JSON,
  status          ENUM('pending','uploaded','scanning','delivered','failed','deleted'),
  error_message   TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_release_distributor (release_id, distributor)
);
```

**[ ] Rollback on partial S3 upload failure**
Currently, if a file copy fails midway the S3 folder is left in a dirty state (some files present, `delivery.complete` never uploaded). The upload must either succeed fully or clean up after itself. Implement try/catch around `uploadReleaseForAudioSalad` that calls the delete logic on any error before re-throwing.

**[ ] Idempotency guard**
Calling the endpoint twice for the same release silently overwrites files in S3. Before uploading, check if the UPC folder already contains a `delivery.complete` file and return a 409 Conflict with a message directing the caller to delete first.

**[ ] Source file validation before copy**
Before attempting to copy audio/image files from the source bucket, verify they exist with a `HeadObjectCommand`. A missing source file currently throws a cryptic S3 error. Return a clear 400 with the missing file URL so the caller knows what to fix.

### Priority 2 — Operational

**[ ] Structured JSON logging**
Replace all `console.log` / `console.warn` / `console.error` with a structured logger (e.g. `pino`). Each log line should include at minimum: `level`, `timestamp`, `releaseId`, `upc`, `message`. This is required for any log aggregation tool (CloudWatch, Datadog, etc.).

**[ ] Health check with real DB ping**
`GET /api/ddex/health` currently returns `ok` unconditionally. It should also run a lightweight DB query (e.g. `SELECT 1`) and return 503 if the DB is unreachable.

**[ ] S3 operation timeout / retry**
Large audio files can cause S3 copy operations to hang. Configure a timeout and add retry logic (with exponential backoff) for transient S3 errors.

**[ ] Per-environment S3 config**
Use separate S3 buckets for staging and production. The env var `S3_INGEST_BUCKET` already supports this but there is no `.env.staging` or deployment documentation for how to switch environments.

### Priority 3 — Full ingestion lifecycle (post go-live)

**[ ] AudioSalad delivery status tracking**
AudioSalad processes the folder after `delivery.complete` is uploaded. There is currently no way to know when processing is complete or if it failed. Options: (a) AudioSalad webhook → endpoint in this service that updates `release_ingestions.status`, or (b) polling job in the main backend that checks AudioSalad's API.

**[ ] Re-ingestion flow documentation**
Document the exact sequence for re-delivering a failed release:
1. `DELETE /api/ddex/ingestion/:upc` — cleans S3 folder
2. Update `release_ingestions.status = 'deleted'` in main backend DB
3. Fix whatever caused the failure (bad audio file, wrong metadata, etc.)
4. `POST /api/ddex/generate` — re-uploads everything
5. Update `release_ingestions` with new upload result

**[ ] Deployment setup**
Deploy to the **same DigitalOcean Droplet** where the main TranKYouTV backend runs. Both services share the same VPC and the managed DB is already accessible internally. Steps:

1. SSH into the Droplet and clone this repo
2. Copy `.env` with production values (DB internal host, S3 credentials, API keys)
3. Run `npm install && npm run build`
4. Use `pm2` to manage the process:
   ```bash
   pm2 start dist/server.js --name tytv-ddex-generator
   pm2 save
   ```
5. Configure Nginx to reverse proxy the port (e.g. `proxy_pass http://localhost:4000`) under a subdomain like `ddex.trankyoutv.com`
6. The main backend calls this service internally via `http://localhost:4000` (same machine, no external network hop needed)

No Dockerfile needed for this setup. If the service is ever moved to its own Droplet or App Platform, add one then.
