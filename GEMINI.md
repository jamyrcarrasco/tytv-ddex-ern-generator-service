# DDEX ERN Generator Service Context

This project is a TypeScript-based microservice designed to generate **DDEX ERN 3.8.2 XML** files for music releases. It serves as a metadata bridge between internal systems and Digital Service Providers (DSPs).

## Project Overview

- **Core Purpose:** Automates the generation of industry-standard DDEX XML metadata from a MySQL database.
- **Key Technologies:**
  - **Runtime:** Node.js (v18+) with Express.
  - **Language:** TypeScript for type safety and maintainability.
  - **Database:** MySQL (interfaced via `mysql2`).
  - **XML Engine:** `xmlbuilder2` for schema-compliant XML construction.
  - **Authentication:** API Key-based security via the `x-api-key` header.
- **Architecture:** Follows a Clean Architecture approach with a clear separation of concerns:
  - **Repositories:** Handle raw SQL queries and data fetching.
  - **Services:** Contain the complex logic for mapping database records to DDEX standard structures.
  - **Routes/Controllers:** Manage HTTP requests, validation, and responses.

## Building and Running

### Development
```bash
# Start the development server with hot-reload
npm run dev
```

### Production
```bash
# Build the project
npm run build

# Start the compiled service
npm run start
```

### Quality Control
```bash
# Run ESLint
npm run lint

# Format code with Prettier
npm run format
```

## Key Components

- **`src/services/ddexGenerator.ts`**: The primary engine that maps internal release data (tracks, artists, deals) to the DDEX ERN 3.8.2 schema.
- **`src/services/AudioSalad_ddexGenerator.ts`**: A specialized generator for AudioSalad-specific DDEX requirements.
- **`src/repositories/releaseRepository.ts`**: Orchestrates complex joins across `releases`, `tracks`, `artists`, `labels`, and `genres`.
- **`src/middleware/apiKeyAuth.ts`**: Validates the `x-api-key` against the `API_KEY` environment variable.

## API Endpoints

- **`GET /health`**: Returns the service status.
- **`POST /api/ddex/generate`**:
  - **Body:** `{ "releaseId": number, "generatorType": "standard" | "audiosalad" }`
  - **Requires:** `x-api-key` header.
  - **Returns:** Application/xml content.

## Development Conventions

- **Type Safety:** Always define types in `src/types/` for any new data structures.
- **Validation:** Route-level validation (in `src/routes/ddexRoutes.ts`) is mandatory before calling service logic.
- **Error Handling:** Use the global error handler in `src/app.ts` for unexpected failures; return semantic 400/404 errors for validation/not-found cases.
- **DDEX Standards:** Any changes to XML output must be verified against the [DDEX ERN 3.8.2 Specification](https://ddex.net/standards/ern/382/).
