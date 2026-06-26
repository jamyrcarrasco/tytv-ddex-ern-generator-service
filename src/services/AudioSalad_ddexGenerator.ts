import { create } from 'xmlbuilder2';
import { ReleaseWithDetails, Track, TrackArtist, ROLE_TO_DDEX_MAP } from '../types/ddex';
import { config } from '../config/env';

// =============================================
// FILENAME HELPERS — exported for s3Service.ts
// =============================================

function getFileExt(url: string): string {
  try {
    return new URL(url).pathname.split('.').pop()?.toLowerCase() || '';
  } catch {
    return url.split('.').pop()?.toLowerCase().split('?')[0] || '';
  }
}

export function getAudioSaladAudioFilename(upc: string, trackNumber: number, url: string): string {
  const ext = getFileExt(url) || 'wav';
  return `${upc}_1_${trackNumber}.${ext}`;
}

export function getAudioSaladImageFilename(upc: string, url: string): string {
  const ext = getFileExt(url) || 'jpg';
  return `${upc}.${ext}`;
}

export function getAudioSaladXmlFilename(upc: string): string {
  return `${upc}.xml`;
}

// =============================================
// MAPPINGS
// =============================================

const ISO_TO_LANGUAGE_NAME: Record<string, string> = {
  es: 'Spanish',
  en: 'English',
  pt: 'Portuguese',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  ar: 'Arabic',
  ru: 'Russian',
  hi: 'Hindi',
};

const RELEASE_FORMAT_MAP: Record<string, string> = {
  Sencillo: 'Single',
  Single: 'Single',
  Album: 'Album',
  'Álbum': 'Album',
  EP: 'EP',
};

const DDEX_ROLE_TO_AUDIOSALAD: Record<string, string> = {
  MainArtist: 'Main Artist',
  FeaturedArtist: 'Featured Artist',
  Producer: 'Producer',
  Composer: 'Composer',
  Lyricist: 'Lyricist',
  Remixer: 'Remixer',
  MixingEngineer: 'Mixing Engineer',
  MasteringEngineer: 'Mastering Engineer',
  Arranger: 'Arranger',
  Engineer: 'Engineer',
  Contributor: 'Contributor',
};

// =============================================
// HELPERS
// =============================================

function formatDate(date: Date | string): string {
  if (typeof date === 'string') return date.split('T')[0];
  return date.toISOString().split('T')[0];
}

function getLanguageName(code: string | undefined): string {
  if (!code) return 'English';
  return ISO_TO_LANGUAGE_NAME[code.toLowerCase()] || 'English';
}

function getAdvisory(tracks: Track[]): string {
  if (tracks.some((t) => t.explicit_status === 'explicit')) return 'Explicit';
  if (tracks.some((t) => t.explicit_status === 'clean' || t.explicit_status === 'edited')) return 'Clean';
  return 'None';
}

function getTrackAdvisory(track: Track): string {
  if (track.explicit_status === 'explicit') return 'Explicit';
  if (track.explicit_status === 'clean' || track.explicit_status === 'edited') return 'Clean';
  return 'None';
}

function getReleaseFormat(typeName: string | undefined): string {
  if (!typeName) return 'Album';
  return RELEASE_FORMAT_MAP[typeName] || typeName;
}

function getArtistDisplayName(artist: TrackArtist): string {
  return artist.stage_name || artist.artist_name || artist.name || 'Unknown Artist';
}

function getReleaseArtistName(release: any): string {
  return release.stage_name || release.artist_name || release.user_name || 'Unknown Artist';
}

function getLabelName(release: any): string {
  return release.label_name || release.record_label || 'Independent Label';
}

function mapRoleToAudioSalad(roleName: string | undefined): string {
  if (!roleName) return 'Contributor';
  const ddexRole = ROLE_TO_DDEX_MAP[roleName] || roleName;
  return DDEX_ROLE_TO_AUDIOSALAD[ddexRole] || roleName;
}

function getImageMimeType(url: string): string {
  const ext = getFileExt(url);
  return ext === 'png' ? 'image/png' : 'image/jpg';
}

function getAudioMimeType(url: string): string {
  const ext = getFileExt(url) || 'wav';
  return `audio/${ext}`;
}

// =============================================
// MAIN GENERATOR
// =============================================

export function generateAudioSaladDdexXml(releaseData: ReleaseWithDetails): string {
  const { release, tracks } = releaseData;
  const releaseArtistName = getReleaseArtistName(release);
  const labelName = getLabelName(release);
  const mainTitle = release.title || release.version_title || release.alt_title || '';
  const releaseDate = formatDate(release.date);
  const advisory = getAdvisory(tracks);
  const audioLanguage = getLanguageName(tracks[0]?.song_language_code);
  const releaseFormat = getReleaseFormat(release.release_type_name);
  const genreName = tracks[0]?.main_genre_en || '';
  const clineText = release.label_cline || release.cline || '';
  const clineYear = release.cline_year || parseInt(release.date.split('-')[0], 10);
  const plineText = release.label_pline || release.pline || '';
  const plineYear = release.pline_year || parseInt(release.date.split('-')[0], 10);
  const rightsHolders = release.record_label || labelName;

  const doc = create({ version: '1.0', encoding: 'UTF-8' }).ele('release', {
    xmlns: 'audiosalad_release_v3.4',
    'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    'xsi:schemaLocation':
      'audiosalad_release_v3.4 http://audiosalad-xsd.s3.amazonaws.com/audiosalad_release_v3.4.xsd',
  });

  doc.ele('schema_id').txt('audiosalad_release_v3.4').up();
  doc.ele('distributor_name').txt(config.s3.distributorName).up();
  doc.ele('export_id').txt(release.id.toString()).up();
  doc.ele('export_time').txt(new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')).up();
  doc.ele('action').txt('add').up();
  doc.ele('upc_ean').txt(release.upc).up();
  doc.ele('catalog_id').txt(release.catalog || release.upc).up();
  doc.ele('title').txt(mainTitle).up();
  doc.ele('advisory').txt(advisory).up();
  doc.ele('metadata_language').txt('English').up();
  doc.ele('audio_language').txt(audioLanguage).up();
  doc.ele('display_artist').txt(releaseArtistName).up();

  doc
    .ele('participant')
    .ele('role').txt('Primary Artist').up()
    .ele('name').txt(releaseArtistName).up()
    .ele('primary').txt('true').up()
    .up();

  doc.ele('compilation').txt('false').up();
  doc.ele('original_release_date').txt(releaseDate).up();
  doc.ele('release_date').txt(releaseDate).up();
  doc.ele('release_format').txt(releaseFormat).up();

  if (genreName) {
    doc.ele('genre').ele('primary').txt(genreName).up().up();
  }

  if (clineText) {
    doc.ele('c_info').txt(clineText).up();
    doc.ele('c_year').txt(clineYear.toString()).up();
  }
  if (plineText) {
    doc.ele('p_info').txt(plineText).up();
    doc.ele('p_year').txt(plineYear.toString()).up();
  }

  doc.ele('rights_holders').txt(rightsHolders).up();

  doc.ele('label').ele('name').txt(labelName).up().up();

  doc.ele('price_tier').ele('type').txt('itunes_track').up().ele('name').txt('Front').up().up();
  doc.ele('price_tier').ele('type').txt('itunes').up().ele('name').txt('Front One').up().up();

  doc
    .ele('territory')
    .ele('country_code').txt('WW').up()
    .ele('release_date').txt(`${releaseDate}T00:00:00`).up()
    .up();

  if (release.front_pic) {
    const imageFilename = getAudioSaladImageFilename(release.upc, release.front_pic);
    doc
      .ele('asset')
      .ele('type').txt('image').up()
      .ele('sub_type').txt('Front').up()
      .ele('format').txt(getImageMimeType(release.front_pic)).up()
      .ele('file_name').txt(imageFilename).up()
      .up();
  }

  tracks.forEach((track) => {
    const trackArtists = track.artists || [];
    const trackLanguage = getLanguageName(track.song_language_code);

    const mainArtistEntry = trackArtists.find(
      (a) => ROLE_TO_DDEX_MAP[a.role_name || ''] === 'MainArtist'
    );
    const trackArtistName = mainArtistEntry
      ? getArtistDisplayName(mainArtistEntry)
      : releaseArtistName;

    const trackEle = doc.ele('track');
    trackEle.ele('isrc').txt(track.isrc).up();
    trackEle.ele('disc_number').txt('1').up();
    trackEle.ele('track_number').txt(track.number.toString()).up();
    trackEle.ele('title').txt(track.song_name).up();
    trackEle.ele('advisory').txt(getTrackAdvisory(track)).up();
    trackEle.ele('audio_language').txt(trackLanguage).up();
    trackEle.ele('display_artist').txt(trackArtistName).up();

    trackEle
      .ele('participant')
      .ele('role').txt('Main Artist').up()
      .ele('name').txt(trackArtistName).up()
      .ele('primary').txt('true').up()
      .up();

    trackArtists
      .filter((a) => ROLE_TO_DDEX_MAP[a.role_name || ''] !== 'MainArtist')
      .forEach((artist) => {
        trackEle
          .ele('participant')
          .ele('role').txt(mapRoleToAudioSalad(artist.role_name)).up()
          .ele('name').txt(getArtistDisplayName(artist)).up()
          .ele('primary').txt('false').up()
          .up();
      });

    if (track.main_genre_en) {
      trackEle.ele('genre').ele('primary').txt(track.main_genre_en).up().up();
    }

    if (clineText) {
      trackEle.ele('c_info').txt(clineText).up();
      trackEle.ele('c_year').txt(clineYear.toString()).up();
    }
    if (plineText) {
      trackEle.ele('p_info').txt(plineText).up();
      trackEle.ele('p_year').txt(plineYear.toString()).up();
    }

    trackEle.ele('rights_holders').txt(rightsHolders).up();

    trackEle.ele('price_tier').ele('type').txt('itunes_track').up().ele('name').txt('Front').up().up();

    trackEle.ele('permission').ele('type').txt('track_sale').up().ele('enabled').txt('true').up().up();

    if (track.sound_url) {
      const audioFilename = getAudioSaladAudioFilename(release.upc, track.number, track.sound_url);
      trackEle
        .ele('asset')
        .ele('type').txt('audio').up()
        .ele('sub_type').txt(getFileExt(track.sound_url) || 'wav').up()
        .ele('format').txt(getAudioMimeType(track.sound_url)).up()
        .ele('file_name').txt(audioFilename).up()
        .up();
    }

    trackEle.up();
  });

  return doc.end({ prettyPrint: true, indent: '  ' });
}
