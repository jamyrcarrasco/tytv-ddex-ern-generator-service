# DDEX ERN Generator Service

A Node.js + TypeScript microservice that generates **DDEX ERN 3.8.2 XML** files for music releases. This service is designed to be called from other systems (TrankYouTV / GateDistro) and provides secure, authenticated access to DDEX metadata generation.

## Features

- 🔐 **API Key Authentication** - Secure access control via x-api-key header
- 🗄️ **MySQL Database Integration** - Fetches release, track, and artist metadata
- 📋 **Comprehensive DDEX ERN 3.8.2 XML** - Generates complete XML with all 4 major sections:
  - **MessageHeader** - Message identification and routing
  - **ResourceList** - Sound recordings and cover art resources
  - **ReleaseList** - Release metadata and references
  - **DealList** - Distribution rights and licensing terms
  - **ReleaseRelationships** - Track sequencing and album structure
- 🎯 **Type-Safe** - Fully typed with TypeScript for reliability
- 🏗️ **Clean Architecture** - Repository pattern with clear separation of concerns

## Prerequisites

- Node.js 18+ (LTS)
- MySQL 5.7+ or 8.0+
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd tytv-ddex-ern-generator-service
```

2. Install dependencies:
```bash
npm install
```

3. Create environment configuration:
```bash
cp example.env .env
```

4. Configure your `.env` file:
```env
PORT=4000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=trankyou_main
API_KEYS=TRANKYOU_KEY,GATEDISTRO_KEY
```

## Database Requirements

The service expects the following tables in your MySQL database:

### `releases` table
- `id` - Primary key
- `title` - Release title
- `release_type` - Album, Single, or EP
- `label_name` - Label name
- `release_date` - Release date (YYYY-MM-DD)
- `upc` - Universal Product Code
- `cover_art_url` - URL to cover art image
- `c_line` - Copyright line (optional)
- `p_line` - Phonographic copyright line (optional)

### `tracks` table
- `id` - Primary key
- `release_id` - Foreign key to releases
- `title` - Track title
- `duration` - Duration in ISO 8601 format (PT3M45S)
- `isrc` - International Standard Recording Code
- `audio_file_url` - URL to audio file
- `track_number` - Track number/position
- `genre` - Genre (optional)

### `artists` table
- `id` - Primary key
- `name` - Artist name

### `release_artists` table (join table)
- `artist_id` - Foreign key to artists
- `release_id` - Foreign key to releases
- `track_id` - Foreign key to tracks (nullable - if null, artist is for the release)
- `role` - Artist role (MainArtist, FeaturedArtist, Producer, etc.)

## Usage

### Development Mode

Run with hot reload:
```bash
npm run dev
```

### Production Mode

Build and run:
```bash
npm run build
npm start
```

### Linting & Formatting

```bash
npm run lint
npm run format
```

## API Endpoints

### Health Check
```
GET /health
```

Response:
```json
{
  "status": "ok",
  "service": "tytv-ddex-ern-generator-service",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Generate DDEX XML
```
POST /api/ddex/generate
```

**Headers:**
```
x-api-key: YOUR_API_KEY
Content-Type: application/json
```

**Request Body:**
```json
{
  "releaseId": 123
}
```

**Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<ern:NewReleaseMessage xmlns:ern="http://ddex.net/xml/ern/38" MessageSchemaVersionId="ern/382">
  <MessageHeader>
    <!-- Message identification -->
  </MessageHeader>
  <ResourceList>
    <!-- Sound recordings and images -->
  </ResourceList>
  <ReleaseList>
    <!-- Release metadata -->
  </ReleaseList>
  <DealList>
    <!-- Distribution rights -->
  </DealList>
  <ReleaseRelationships>
    <!-- Track sequencing -->
  </ReleaseRelationships>
</ern:NewReleaseMessage>
```

### Example cURL Request

```bash
curl -X POST http://localhost:4000/api/ddex/generate \
  -H "x-api-key: TRANKYOU_KEY" \
  -H "Content-Type: application/json" \
  -d '{"releaseId": 123}'
```

### Example with Response to File

```bash
curl -X POST http://localhost:4000/api/ddex/generate \
  -H "x-api-key: TRANKYOU_KEY" \
  -H "Content-Type: application/json" \
  -d '{"releaseId": 123}' \
  -o release_123.xml
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Bad Request",
  "message": "releaseId is required in the request body"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "API key is required. Please provide a valid API key in the x-api-key header."
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Release with ID 123 not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "An error occurred while generating DDEX XML"
}
```

## Project Structure

```
tytv-ddex-ern-generator-service/
├── src/
│   ├── config/
│   │   ├── db.ts              # MySQL connection pool
│   │   └── env.ts             # Environment variables loader
│   ├── middleware/
│   │   └── apiKeyAuth.ts      # API key authentication
│   ├── repositories/
│   │   └── releaseRepository.ts  # Database queries
│   ├── routes/
│   │   └── ddexRoutes.ts      # HTTP routes
│   ├── services/
│   │   └── ddexGenerator.ts   # DDEX XML generator
│   ├── types/
│   │   ├── ddex.ts            # TypeScript types
│   │   └── express.d.ts       # Express type augmentation
│   ├── app.ts                 # Express app configuration
│   └── server.ts              # Server entry point
├── .eslintrc.cjs              # ESLint configuration
├── .gitignore                 # Git ignore rules
├── .prettierrc                # Prettier configuration
├── example.env                # Environment template
├── package.json               # Dependencies and scripts
├── README.md                  # This file
└── tsconfig.json              # TypeScript configuration
```

## DDEX ERN 3.8.2 Specification

This service generates XML compliant with the DDEX ERN (Electronic Release Notification) 3.8.2 standard. For more information about DDEX standards, visit:

- [DDEX Website](https://ddex.net/)
- [ERN 3.8.2 Documentation](https://ddex.net/standards/ern/382/)

## License

ISC

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run linting and formatting
5. Submit a pull request

## Support

For issues or questions, please open an issue in the repository.
