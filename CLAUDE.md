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
