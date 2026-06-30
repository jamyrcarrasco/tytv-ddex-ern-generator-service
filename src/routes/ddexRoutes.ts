import { Router, Request, Response } from 'express';
import { getReleaseWithDetails } from '../repositories/releaseRepository';
import { generateDdexXml } from '../services/ddexGenerator';
import { generateAudioSaladDdexXml } from '../services/AudioSalad_ddexGenerator';
import { uploadReleaseForAudioSalad, deleteReleaseFromS3, checkDeliveryComplete, SourceFileMissingError } from '../services/s3Service';
import { DdexGeneratorType } from '../types/ddex';
import logger from '../config/logger';

const router = Router();

/**
 * POST /api/ddex/generate
 * Generate DDEX ERN 3.8.2 XML for a release
 */
router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { releaseId, generatorType = 'standard' } = req.body;

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

    // Validate generatorType
    const validGeneratorTypes: DdexGeneratorType[] = ['standard', 'audiosalad'];
    if (generatorType && !validGeneratorTypes.includes(generatorType)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'generatorType must be either "standard" or "audiosalad"',
        validTypes: validGeneratorTypes,
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

    // =============================================
    // DDEX REQUIRED FIELDS VALIDATION
    // =============================================

    // Validate UPC (required for DDEX)
    if (!releaseData.release.upc || releaseData.release.upc.trim() === '') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Release must have a confirmed UPC code. Please assign a UPC before generating DDEX XML.',
        missingField: 'upc',
      });
      return;
    }

    // Validate ISRC for all tracks
    const tracksWithoutIsrc = releaseData.tracks.filter(
      (track) => !track.isrc || track.isrc.trim() === ''
    );
    
    if (tracksWithoutIsrc.length > 0) {
      const trackNames = tracksWithoutIsrc.map((t) => t.song_name).join(', ');
      res.status(400).json({
        error: 'Bad Request',
        message: `The following tracks are missing ISRC codes: ${trackNames}. All tracks must have ISRC codes to generate DDEX XML.`,
        missingField: 'isrc',
        tracksWithoutIsrc: tracksWithoutIsrc.map((t) => ({
          id: t.id,
          name: t.song_name,
        })),
      });
      return;
    }

    // Validate release date
    if (!releaseData.release.date) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Release must have a release date to generate DDEX XML.',
        missingField: 'date',
      });
      return;
    }

    // Validate track durations
    const tracksWithoutDuration = releaseData.tracks.filter(
      (track) => !track.sound_length || track.sound_length.trim() === ''
    );
    
    if (tracksWithoutDuration.length > 0) {
      const trackNames = tracksWithoutDuration.map((t) => t.song_name).join(', ');
      res.status(400).json({
        error: 'Bad Request',
        message: `The following tracks are missing duration information: ${trackNames}. All tracks must have duration to generate DDEX XML.`,
        missingField: 'sound_length',
        tracksWithoutDuration: tracksWithoutDuration.map((t) => ({
          id: t.id,
          name: t.song_name,
        })),
      });
      return;
    }

    // Validate sound URLs
    const tracksWithoutUrl = releaseData.tracks.filter(
      (track) => !track.sound_url || track.sound_url.trim() === ''
    );
    
    if (tracksWithoutUrl.length > 0) {
      const trackNames = tracksWithoutUrl.map((t) => t.song_name).join(', ');
      res.status(400).json({
        error: 'Bad Request',
        message: `The following tracks are missing audio file URLs: ${trackNames}. All tracks must have audio files to generate DDEX XML.`,
        missingField: 'sound_url',
        tracksWithoutUrl: tracksWithoutUrl.map((t) => ({
          id: t.id,
          name: t.song_name,
        })),
      });
      return;
    }

    if (generatorType === 'audiosalad') {
      const alreadyDelivered = await checkDeliveryComplete(releaseData.release.upc);
      if (alreadyDelivered) {
        res.status(409).json({
          error: 'Conflict',
          message: `UPC ${releaseData.release.upc} already has an active ingestion. Call DELETE /api/ddex/ingestion/${releaseData.release.upc} first.`,
        });
        return;
      }

      const ddexXml = generateAudioSaladDdexXml(releaseData);
      const s3Result = await uploadReleaseForAudioSalad(releaseData, ddexXml);
      res.status(200).json({
        success: true,
        s3_bucket: s3Result.s3_bucket,
        s3_path: s3Result.s3_path,
        files: s3Result.files,
      });
      return;
    }

    // Standard: return XML directly
    const ddexXml = generateDdexXml(releaseData);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('X-Generator-Type', generatorType);
    res.status(200).send(ddexXml);
  } catch (error) {
    if (error instanceof SourceFileMissingError) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'One or more source files are missing in S3. Fix the file URLs and try again.',
        missingFiles: error.missingUrls,
      });
      return;
    }
    logger.error({ err: error }, 'Error generating DDEX XML');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while generating DDEX XML',
    });
  }
});

/**
 * DELETE /api/ddex/ingestion/:upc
 * Delete all S3 files for an AudioSalad ingestion folder by UPC
 */
router.delete('/ingestion/:upc', async (req: Request, res: Response): Promise<void> => {
  const { upc } = req.params;

  if (!upc || upc.trim() === '') {
    res.status(400).json({ error: 'Bad Request', message: 'upc param is required' });
    return;
  }

  try {
    const result = await deleteReleaseFromS3(upc);

    if (result.deleted.length === 0) {
      res.status(404).json({ error: 'Not Found', message: `No files found for UPC ${upc}` });
      return;
    }

    res.status(200).json({ success: true, upc, deleted: result.deleted });
  } catch (error) {
    logger.error({ err: error, upc }, 'Error deleting S3 ingestion');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while deleting the ingestion files',
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

