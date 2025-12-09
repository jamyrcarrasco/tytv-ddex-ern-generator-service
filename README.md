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
