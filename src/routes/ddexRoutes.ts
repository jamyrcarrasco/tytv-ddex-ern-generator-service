import { Router, Request, Response } from 'express';
import { getReleaseWithDetails } from '../repositories/releaseRepository';
import { generateDdexXml } from '../services/ddexGenerator';

const router = Router();

/**
 * POST /api/ddex/generate
 * Generate DDEX ERN 3.8.2 XML for a release
 */
router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { releaseId } = req.body;

    // Validate releaseId
    if (!releaseId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'releaseId is required in the request body',
      });
      return;
    }

    // Validate releaseId is a number
    const releaseIdNum = parseInt(releaseId, 10);
    if (isNaN(releaseIdNum) || releaseIdNum <= 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'releaseId must be a valid positive number',
      });
      return;
    }

    // Fetch release data from database
    const releaseData = await getReleaseWithDetails(releaseIdNum);

    if (!releaseData) {
      res.status(404).json({
        error: 'Not Found',
        message: `Release with ID ${releaseIdNum} not found`,
      });
      return;
    }

    // Validate that the release has tracks
    if (!releaseData.tracks || releaseData.tracks.length === 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Release must have at least one track to generate DDEX XML',
      });
      return;
    }

    // Generate DDEX XML
    const ddexXml = generateDdexXml(releaseData);

    // Return XML with appropriate content type
    res.setHeader('Content-Type', 'application/xml');
    res.status(200).send(ddexXml);
  } catch (error) {
    console.error('Error generating DDEX XML:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while generating DDEX XML',
    });
  }
});

/**
 * GET /api/ddex/health
 * Health check endpoint (doesn't require API key)
 */
router.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'ok',
    service: 'tytv-ddex-ern-generator-service',
    version: '1.0.0',
  });
});

export default router;

