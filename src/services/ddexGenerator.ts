import { create } from 'xmlbuilder2';
import {
  ReleaseWithDetails,
  TrackArtist,
  ROLE_TO_DDEX_MAP,
  EXPLICIT_STATUS_MAP,
  MIX_VERSION_MAP,
} from '../types/ddex';

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
 * Convert various duration formats to ISO 8601 duration (PT3M45S)
 */
function convertToIsoDuration(duration: string): string {
  // If already in ISO 8601 format
  if (duration.startsWith('PT')) {
    return duration;
  }

  // Parse MM:SS or HH:MM:SS format
  const parts = duration.split(':').map(p => parseInt(p, 10));
  
  if (parts.length === 2) {
    // MM:SS format
    const [minutes, seconds] = parts;
    return `PT${minutes}M${seconds}S`;
  } else if (parts.length === 3) {
    // HH:MM:SS format
    const [hours, minutes, seconds] = parts;
    if (hours > 0) {
      return `PT${hours}H${minutes}M${seconds}S`;
    }
    return `PT${minutes}M${seconds}S`;
  }

  // Default fallback
  return 'PT0S';
}

/**
 * Map role name to DDEX standard role
 */
function mapRoleToDdex(roleName: string): string {
  return ROLE_TO_DDEX_MAP[roleName] || 'Contributor';
}

/**
 * Map explicit status to DDEX ParentalWarningType
 */
function mapExplicitStatus(status: string | undefined): string | null {
  if (!status) return null;
  return EXPLICIT_STATUS_MAP[status.toLowerCase()] || null;
}

/**
 * Map mix version to DDEX VersionType
 */
function mapMixVersion(mixVersion: string | undefined): string | null {
  if (!mixVersion) return null;
  const lowerVersion = mixVersion.toLowerCase();
  for (const [key, value] of Object.entries(MIX_VERSION_MAP)) {
    if (lowerVersion.includes(key)) {
      return value;
    }
  }
  return null;
}

/**
 * Get artist display name (prefer stage_name > artist_name > name)
 */
function getArtistName(artist: TrackArtist): string {
  return artist.stage_name || artist.artist_name || artist.name || 'Unknown Artist';
}

/**
 * Get main artist name from release
 */
function getReleaseArtistName(release: any): string {
  return release.stage_name || release.artist_name || release.user_name || 'Unknown Artist';
}

/**
 * Get label name from release
 */
function getLabelName(release: any): string {
  return release.label_name || release.record_label || 'Independent Label';
}

/**
 * Filter artists by role category
 */
function getArtistsByRole(artists: TrackArtist[], roleName: string): TrackArtist[] {
  return artists.filter(a => {
    const mappedRole = mapRoleToDdex(a.role_name || '');
    return mappedRole === roleName;
  });
}

/**
 * Get primary artists (MainArtist or FeaturedArtist)
 */
function getPrimaryArtists(artists: TrackArtist[]): TrackArtist[] {
  const mainArtists = getArtistsByRole(artists, 'MainArtist');
  if (mainArtists.length > 0) {
    return mainArtists;
  }
  return artists.filter(a => a.role_name && a.role_name.toLowerCase().includes('artist'));
}

/**
 * Generate comprehensive DDEX ERN 3.8.2 XML
 */
export function generateDdexXml(releaseData: ReleaseWithDetails): string {
  const { release, tracks } = releaseData;
  const messageId = generateMessageId();
  const sentDateTime = new Date().toISOString();
  const labelName = getLabelName(release);
  const releaseArtistName = getReleaseArtistName(release);

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
    .ele('FullName').txt(labelName).up()
    .up()
    .up()
    .ele('MessageRecipient')
    .ele('PartyId').txt('DPID:PADPIDA2013011301U').up()
    .ele('PartyName')
    .ele('FullName').txt('Digital Service Provider').up()
    .up()
    .up();

  // Add catalog number if available
  if (release.catalog) {
    doc.ele('MessageControlType').txt('TestMessage').up();
  }

  doc.up(); // Close MessageHeader

  // =============================================
  // 1. RESOURCE LIST
  // =============================================
  const resourceList = doc.ele('ResourceList');

  // Add SoundRecording resources for each track
  tracks.forEach((track) => {
    const trackArtists = track.artists || [];
    const primaryArtists = getPrimaryArtists(trackArtists);
    const contributors = trackArtists;

    const soundRecording = resourceList.ele('SoundRecording');
    
    // Resource reference and type
    soundRecording.ele('ResourceReference').txt(`A${track.id}`).up();
    soundRecording.ele('Type').txt('MusicalWorkSoundRecording').up();
    
    // Resource ID (ISRC)
    soundRecording.ele('ResourceId')
      .ele('ISRC').txt(track.isrc).up()
      .up();

    // Display title
    soundRecording.ele('DisplayTitleText').txt(track.song_name).up();

    // Version title if mix version exists
    const versionType = mapMixVersion(track.mix_version);
    if (versionType && track.mix_version) {
      soundRecording.ele('DisplayTitle')
        .ele('TitleText').txt(`${track.song_name} (${track.mix_version})`).up()
        .ele('SubTitle').txt(track.mix_version).up()
        .up();
    }

    // Display artists
    if (primaryArtists.length > 0) {
      primaryArtists.forEach((artist) => {
        const ddexRole = mapRoleToDdex(artist.role_name || '');
        soundRecording.ele('DisplayArtist')
          .ele('PartyName')
          .ele('FullName').txt(getArtistName(artist)).up()
          .up()
          .ele('ArtistRole').txt(ddexRole).up()
          .up();
      });
    } else {
      // Fallback to release main artist
      soundRecording.ele('DisplayArtist')
        .ele('PartyName')
        .ele('FullName').txt(releaseArtistName).up()
        .up()
        .ele('ArtistRole').txt('MainArtist').up()
        .up();
    }

    // Contributors (all roles)
    contributors.forEach((artist) => {
      const ddexRole = mapRoleToDdex(artist.role_name || '');
      soundRecording.ele('Contributor')
        .ele('PartyName')
        .ele('FullName').txt(getArtistName(artist)).up()
        .up()
        .ele('Role').txt(ddexRole).up()
        .up();
    });

    // Language of performance
    if (track.song_language_code) {
      soundRecording.ele('LanguageOfPerformance').txt(track.song_language_code).up();
    }

    // Parental warning (explicit content)
    const parentalWarning = mapExplicitStatus(track.explicit_status);
    if (parentalWarning) {
      soundRecording.ele('ParentalWarningType').txt(parentalWarning).up();
    }

    // PLine (use label's pline or release's pline)
    const plineText = release.label_pline || release.pline;
    const plineYear = release.pline_year || parseInt(release.date.split('-')[0], 10);
    if (plineText) {
      soundRecording.ele('PLine')
        .ele('Year').txt(plineYear.toString()).up()
        .ele('PLineText').txt(plineText).up()
        .up();
    }

    // Genres (primary and secondary)
    if (track.main_genre_en) {
      soundRecording.ele('Genre')
        .ele('GenreText').txt(track.main_genre_en).up()
        .up();
    }
    if (track.secondary_genre_en) {
      soundRecording.ele('Genre')
        .ele('GenreText').txt(track.secondary_genre_en).up()
        .up();
    }

    // Duration
    const duration = convertToIsoDuration(track.sound_length);
    soundRecording.ele('Duration').txt(duration).up();

    // Lyrics information
    if (track.has_lyrics) {
      soundRecording.ele('ContainsLyrics').txt('true').up();
      
      // Language of lyrics
      if (track.lyrics_language_code) {
        soundRecording.ele('LanguageOfLyrics').txt(track.lyrics_language_code).up();
      }
    }

    // Technical sound recording details
    const technicalDetails = soundRecording.ele('TechnicalSoundRecordingDetails');
    technicalDetails.ele('TechnicalResourceDetailsReference').txt(`T${track.id}`).up();
    
    // Audio codec (determine from audio_style or default to MP3)
    const audioCodec = track.audio_style?.toUpperCase() || 'MP3';
    technicalDetails.ele('AudioCodecType').txt(audioCodec).up();
    
    // File information
    if (track.sound_url) {
      technicalDetails.ele('File')
        .ele('URI').txt(track.sound_url).up()
        .up();
    }
    
    technicalDetails.up(); // Close TechnicalSoundRecordingDetails
    soundRecording.up(); // Close SoundRecording
  });

  // Add Image resource for cover art
  if (release.front_pic) {
    const image = resourceList.ele('Image');
    image.ele('ResourceReference').txt('R1').up();
    image.ele('Type').txt('FrontCoverImage').up();
    image.ele('ResourceId')
      .ele('ProprietaryId').txt(`IMG${release.id}`).up()
      .up();
    
    const imageTechnical = image.ele('TechnicalImageDetails');
    imageTechnical.ele('TechnicalResourceDetailsReference').txt('T_IMG1').up();
    imageTechnical.ele('ImageCodecType').txt('JPEG').up();
    
    // Parse dimensions if available
    if (release.label?.release_front_art_dimensions) {
      const dimensions = release.label.release_front_art_dimensions.split('x');
      if (dimensions.length === 2) {
        imageTechnical.ele('ImageHeight').txt(dimensions[1].trim()).up();
        imageTechnical.ele('ImageWidth').txt(dimensions[0].trim()).up();
      }
    } else {
      imageTechnical.ele('ImageHeight').txt('3000').up();
      imageTechnical.ele('ImageWidth').txt('3000').up();
    }
    
    imageTechnical.ele('File')
      .ele('URI').txt(release.front_pic).up()
      .up();
    
    imageTechnical.up();
    image.up();
  }

  resourceList.up(); // Close ResourceList

  // =============================================
  // 2. RELEASE LIST
  // =============================================
  const releaseList = doc.ele('ReleaseList').ele('Release');
  
  releaseList.ele('ReleaseReference').txt(`R${release.id}`).up();
  
  // Release type (map from database)
  const releaseType = release.release_type_name || 'Album';
  const ddexReleaseType = releaseType === 'Sencillo' ? 'Single' : releaseType;
  releaseList.ele('ReleaseType').txt(ddexReleaseType).up();
  
  // Release ID (UPC/EAN)
  releaseList.ele('ReleaseId')
    .ele('ICPN').txt(release.upc).up()
    .up();
  
  // Catalog number
  if (release.catalog) {
    releaseList.ele('ReleaseId')
      .ele('CatalogNumber').txt(release.catalog).up()
      .up();
  }

  // Display title
  const mainTitle = release.version_title || release.alt_title;
  if (mainTitle) {
    releaseList.ele('DisplayTitleText').txt(mainTitle).up();
  }
  
  // Alternative title
  if (release.alt_title && release.alt_title !== mainTitle) {
    releaseList.ele('DisplayTitle')
      .ele('TitleText').txt(release.alt_title).up()
      .ele('TitleType').txt('AlternativeTitle').up()
      .up();
  }

  // Display artist (main release artist)
  releaseList.ele('DisplayArtist')
    .ele('PartyName')
    .ele('FullName').txt(releaseArtistName).up()
    .up()
    .ele('ArtistRole').txt('MainArtist').up()
    .up();

  // Label information
  releaseList.ele('AdministratingRecordCompany')
    .ele('PartyName')
    .ele('FullName').txt(labelName).up()
    .up()
    .up();

  // CLine (copyright)
  const clineText = release.label_cline || release.cline;
  const clineYear = release.cline_year || parseInt(release.date.split('-')[0], 10);
  if (clineText) {
    releaseList.ele('CLine')
      .ele('Year').txt(clineYear.toString()).up()
      .ele('CLineText').txt(clineText).up()
      .up();
  }

  // PLine (phonographic copyright)
  const plineText = release.label_pline || release.pline;
  const plineYear = release.pline_year || parseInt(release.date.split('-')[0], 10);
  if (plineText) {
    releaseList.ele('PLine')
      .ele('Year').txt(plineYear.toString()).up()
      .ele('PLineText').txt(plineText).up()
      .up();
  }

  // Genres (from first track)
  if (tracks.length > 0 && tracks[0].main_genre_en) {
    releaseList.ele('Genre')
      .ele('GenreText').txt(tracks[0].main_genre_en).up()
      .up();
    
    if (tracks[0].secondary_genre_en) {
      releaseList.ele('Genre')
        .ele('GenreText').txt(tracks[0].secondary_genre_en).up()
        .up();
    }
  }

  // Release date
  releaseList.ele('ReleaseDate').txt(formatDate(release.date)).up();

  // Resource references
  tracks.forEach((track) => {
    releaseList.ele('ResourceReference').txt(`A${track.id}`).up();
  });

  if (release.front_pic) {
    releaseList.ele('ResourceReference').txt('R1').up();
  }

  releaseList.up().up(); // Close Release and ReleaseList

  // =============================================
  // 3. DEAL LIST - Comprehensive Coverage
  // =============================================
  const dealList = doc.ele('DealList').ele('ReleaseDeal');
  dealList.ele('DealReleaseReference').txt(`R${release.id}`).up();

  // Deal 1: Streaming (Subscription Model - Spotify Premium, Apple Music, etc.)
  dealList.ele('Deal')
    .ele('DealTerms')
    .ele('CommercialModelType').txt('SubscriptionModel').up()
    .ele('UseType').txt('OnDemandStream').up()
    .ele('TerritoryCode').txt('Worldwide').up()
    .ele('ValidityPeriod')
    .ele('StartDate').txt(formatDate(release.date)).up()
    .up()
    .up()
    .up();

  // Deal 2: Download (Pay-as-you-go - iTunes, Amazon Music)
  dealList.ele('Deal')
    .ele('DealTerms')
    .ele('CommercialModelType').txt('PayAsYouGoModel').up()
    .ele('UseType').txt('PermanentDownload').up()
    .ele('TerritoryCode').txt('Worldwide').up()
    .ele('ValidityPeriod')
    .ele('StartDate').txt(formatDate(release.date)).up()
    .up()
    .ele('PriceInformation')
    .ele('BulkOrderWholesalePricePerUnit').txt('0.99').up()
    .up()
    .up()
    .up();

  // Deal 3: Free Streaming (Ad-supported - Free Spotify, YouTube Music Free)
  dealList.ele('Deal')
    .ele('DealTerms')
    .ele('CommercialModelType').txt('AdvertisementSupportedModel').up()
    .ele('UseType').txt('OnDemandStream').up()
    .ele('TerritoryCode').txt('Worldwide').up()
    .ele('ValidityPeriod')
    .ele('StartDate').txt(formatDate(release.date)).up()
    .up()
    .up()
    .up();

  // Deal 4: Conditional Download (Subscription offline - Spotify/Apple Music offline)
  dealList.ele('Deal')
    .ele('DealTerms')
    .ele('CommercialModelType').txt('SubscriptionModel').up()
    .ele('UseType').txt('ConditionalDownload').up()
    .ele('TerritoryCode').txt('Worldwide').up()
    .ele('ValidityPeriod')
    .ele('StartDate').txt(formatDate(release.date)).up()
    .up()
    .up()
    .up();

  // Deal 5: User-Made Clips (TikTok, Instagram Reels, YouTube Shorts)
  dealList.ele('Deal')
    .ele('DealTerms')
    .ele('CommercialModelType').txt('AdvertisementSupportedModel').up()
    .ele('UseType').txt('UserMadeClip').up()
    .ele('TerritoryCode').txt('Worldwide').up()
    .ele('ValidityPeriod')
    .ele('StartDate').txt(formatDate(release.date)).up()
    .up()
    .up()
    .up();

  dealList.up().up(); // Close ReleaseDeal and DealList

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
