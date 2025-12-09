import { create } from 'xmlbuilder2';
import { ReleaseWithDetails, Artist } from '../types/ddex';

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `DDEX${timestamp}${random}`;
}

/**
 * Format date to DDEX format (YYYY-MM-DD)
 */
function formatDate(date: Date | string): string {
  if (typeof date === 'string') {
    return date.split('T')[0];
  }
  return date.toISOString().split('T')[0];
}

/**
 * Get main artist(s) for the release
 */
function getMainArtists(artists: Artist[]): Artist[] {
  return artists.filter((a) => a.role === 'MainArtist' && !a.trackId);
}

/**
 * Get artists for a specific track
 */
function getTrackArtists(artists: Artist[], trackId: number): Artist[] {
  return artists.filter((a) => a.trackId === trackId);
}

/**
 * Generate comprehensive DDEX ERN 3.8.2 XML
 */
export function generateDdexXml(releaseData: ReleaseWithDetails): string {
  const { release, tracks, artists } = releaseData;
  const messageId = generateMessageId();
  const sentDateTime = new Date().toISOString();
  const mainArtists = getMainArtists(artists);

  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('ern:NewReleaseMessage', {
      'xmlns:ern': 'http://ddex.net/xml/ern/38',
      'xmlns:xs': 'http://www.w3.org/2001/XMLSchema-instance',
      MessageSchemaVersionId: 'ern/382',
      LanguageAndScriptCode: 'en',
    })

    // =============================================
    // MESSAGE HEADER
    // =============================================
    .ele('MessageHeader')
    .ele('MessageThreadId').txt(messageId).up()
    .ele('MessageId').txt(messageId).up()
    .ele('MessageCreatedDateTime').txt(sentDateTime).up()
    .ele('MessageSender')
    .ele('PartyId').txt('DPID:PADPIDA2014071501Y').up()
    .ele('PartyName')
    .ele('FullName').txt(release.labelName || 'Independent Label').up()
    .up()
    .up()
    .ele('MessageRecipient')
    .ele('PartyId').txt('DPID:PADPIDA2013011301U').up()
    .ele('PartyName')
    .ele('FullName').txt('Digital Service Provider').up()
    .up()
    .up()
    .up()

    // =============================================
    // 1. RESOURCE LIST
    // =============================================
    .ele('ResourceList');

  // Add SoundRecording resources for each track
  tracks.forEach((track) => {
    const trackArtists = getTrackArtists(artists, track.id);
    const primaryArtists = trackArtists.length > 0 ? trackArtists : mainArtists;

    const soundRecording = doc.ele('SoundRecording')
      .ele('ResourceReference').txt(`A${track.id}`).up()
      .ele('Type').txt('MusicalWorkSoundRecording').up()
      .ele('ResourceId')
      .ele('ISRC').txt(track.isrc).up()
      .up();

    // Add display title
    soundRecording.ele('DisplayTitleText').txt(track.title).up();

    // Add display artist(s)
    primaryArtists.forEach((artist) => {
      soundRecording.ele('DisplayArtist')
        .ele('PartyName')
        .ele('FullName').txt(artist.name).up()
        .up()
        .ele('ArtistRole').txt(artist.role).up()
        .up();
    });

    // Add contributors
    primaryArtists.forEach((artist) => {
      soundRecording.ele('Contributor')
        .ele('PartyName')
        .ele('FullName').txt(artist.name).up()
        .up()
        .ele('Role').txt(artist.role).up()
        .up();
    });

    // Add PLine
    if (release.pLine) {
      soundRecording.ele('PLine')
        .ele('Year').txt(release.releaseDate.split('-')[0]).up()
        .ele('PLineText').txt(release.pLine).up()
        .up();
    }

    // Add genre
    if (track.genre) {
      soundRecording.ele('Genre')
        .ele('GenreText').txt(track.genre).up()
        .up();
    }

    // Add duration
    soundRecording.ele('Duration').txt(track.duration).up();

    // Add technical details
    soundRecording.ele('TechnicalSoundRecordingDetails')
      .ele('TechnicalResourceDetailsReference').txt(`T${track.id}`).up()
      .ele('AudioCodecType').txt('MP3').up()
      .ele('File')
      .ele('URI').txt(track.audioFileUrl).up()
      .up()
      .up();

    soundRecording.up();
  });

  // Add Image resource for cover art
  if (release.coverArtUrl) {
    doc.ele('Image')
      .ele('ResourceReference').txt('R1').up()
      .ele('Type').txt('FrontCoverImage').up()
      .ele('ResourceId')
      .ele('ProprietaryId').txt(`IMG${release.id}`).up()
      .up()
      .ele('TechnicalImageDetails')
      .ele('TechnicalResourceDetailsReference').txt('T_IMG1').up()
      .ele('ImageCodecType').txt('JPEG').up()
      .ele('ImageHeight').txt('3000').up()
      .ele('ImageWidth').txt('3000').up()
      .ele('File')
      .ele('URI').txt(release.coverArtUrl).up()
      .up()
      .up()
      .up();
  }

  doc.up(); // Close ResourceList

  // =============================================
  // 2. RELEASE LIST
  // =============================================
  const releaseList = doc.ele('ReleaseList')
    .ele('Release')
    .ele('ReleaseReference').txt(`R${release.id}`).up()
    .ele('ReleaseType').txt(release.releaseType).up()
    .ele('ReleaseId')
    .ele('ICPN').txt(release.upc).up()
    .up();

  // Add release title
  releaseList.ele('DisplayTitleText').txt(release.title).up();

  // Add display artist(s)
  mainArtists.forEach((artist) => {
    releaseList.ele('DisplayArtist')
      .ele('PartyName')
      .ele('FullName').txt(artist.name).up()
      .up()
      .ele('ArtistRole').txt(artist.role).up()
      .up();
  });

  // Add label name
  releaseList.ele('AdministratingRecordCompany')
    .ele('PartyName')
    .ele('FullName').txt(release.labelName).up()
    .up()
    .up();

  // Add CLine
  if (release.cLine) {
    releaseList.ele('CLine')
      .ele('Year').txt(release.releaseDate.split('-')[0]).up()
      .ele('CLineText').txt(release.cLine).up()
      .up();
  }

  // Add PLine
  if (release.pLine) {
    releaseList.ele('PLine')
      .ele('Year').txt(release.releaseDate.split('-')[0]).up()
      .ele('PLineText').txt(release.pLine).up()
      .up();
  }

  // Add genre from first track
  if (tracks.length > 0 && tracks[0].genre) {
    releaseList.ele('Genre')
      .ele('GenreText').txt(tracks[0].genre).up()
      .up();
  }

  // Add release date
  releaseList.ele('ReleaseDate').txt(formatDate(release.releaseDate)).up();

  // Add resource references
  tracks.forEach((track) => {
    releaseList.ele('ResourceReference').txt(`A${track.id}`).up();
  });

  if (release.coverArtUrl) {
    releaseList.ele('ResourceReference').txt('R1').up();
  }

  releaseList.up().up(); // Close Release and ReleaseList

  // =============================================
  // 3. DEAL LIST
  // =============================================
  doc.ele('DealList')
    .ele('ReleaseDeal')
    .ele('DealReleaseReference').txt(`R${release.id}`).up()
    .ele('Deal')
    .ele('DealTerms')
    .ele('CommercialModelType').txt('SubscriptionModel').up()
    .ele('UseType').txt('OnDemandStream').up()
    .ele('TerritoryCode').txt('Worldwide').up()
    .ele('ValidityPeriod')
    .ele('StartDate').txt(formatDate(release.releaseDate)).up()
    .up()
    .up()
    .up()
    .ele('Deal')
    .ele('DealTerms')
    .ele('CommercialModelType').txt('PayAsYouGoModel').up()
    .ele('UseType').txt('PermanentDownload').up()
    .ele('TerritoryCode').txt('Worldwide').up()
    .ele('ValidityPeriod')
    .ele('StartDate').txt(formatDate(release.releaseDate)).up()
    .up()
    .ele('PriceInformation')
    .ele('BulkOrderWholesalePricePerUnit').txt('0.99').up()
    .up()
    .up()
    .up()
    .up()
    .up();

  // =============================================
  // 4. RELEASE RELATIONSHIPS
  // =============================================
  if (tracks.length > 1) {
    const relationships = doc.ele('ReleaseRelationships');

    tracks.forEach((track, index) => {
      relationships.ele('ResourceRelatedResourceReference')
        .ele('ResourceRelatedResourceReference').txt(`A${track.id}`).up()
        .ele('ReleaseResourceReference').txt(`R${release.id}`).up()
        .ele('SequenceNumber').txt((index + 1).toString()).up()
        .up();
    });

    relationships.up();
  }

  doc.up(); // Close NewReleaseMessage

  return doc.end({ prettyPrint: true });
}

