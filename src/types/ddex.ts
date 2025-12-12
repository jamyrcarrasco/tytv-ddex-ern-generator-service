/**
 * DDEX ERN 3.8.2 Type Definitions - Comprehensive
 * Aligned with TrankYouTV database structure
 */

// =============================================
// LOOKUP TABLE TYPES
// =============================================

export interface Label {
  id: number;
  tenant_id: number;
  name: string;
  logo?: string;
  cline?: string;
  pline?: string;
  releases_percent?: number;
  max_primary_artist?: number;
  max_composer?: number;
  sound_formats?: string;
  release_front_art_dimensions?: string;
  minimum_payment?: number;
}

export interface Genre {
  id: number;
  name: string;
  name_en: string;
  parent_id: number;
}

export interface Language {
  id: number;
  name: string;
  code: string; // ISO 639-1
  direction: string;
}

export interface Role {
  id: number;
  name: string;
  guard_name: string;
  is_release_role: number;
  category: number;
}

export interface ReleaseType {
  id: number;
  name: string;
  color_class: string;
}

export interface User {
  id: number;
  tenant_id: number;
  spotify_id?: string;
  label_id?: number;
  artist_name?: string;
  stage_name?: string;
  name?: string;
  phone?: string;
  email?: string;
}

// =============================================
// MAIN ENTITY TYPES
// =============================================

export interface Release {
  id: number;
  tenant_id: number;
  spotify_id?: string;
  label_id: number;
  created_by: number; // Main artist user_id
  release_status_id: number;
  release_type_id: number;
  version_title?: string;
  alt_title?: string;
  upc: string; // Required for DDEX
  request_upc?: string;
  catalog?: string;
  front_pic?: string;
  front_pic_thumb?: string;
  date: string; // Release date
  record_label?: string;
  cline?: string;
  pline?: string;
  cline_year?: number;
  pline_year?: number;
  fan_link_page_text?: string;
  global_distribution: number;
  created_at?: string | Date;
  updated_at?: string | Date;
  // Relations (populated by JOINs)
  label?: Label;
  label_name?: string;
  label_logo?: string;
  label_cline?: string;
  label_pline?: string;
  release_type_name?: string;
  releaseType?: ReleaseType;
  mainArtist?: User;
  artist_name?: string;
  stage_name?: string;
  user_name?: string;
}

export interface Track {
  id: number;
  release_id: number;
  main_gender_id: number;
  secondary_gender_id?: number;
  song_language_id?: number;
  lyrics_language_id?: number;
  price_tier_id?: number;
  song_name: string;
  mix_version?: string;
  has_lyrics: number;
  isrc: string; // Required for DDEX
  request_isrc?: string;
  explicit_status?: string;
  sound_path?: string;
  sound_url?: string;
  sound_file_size?: string;
  sound_length: string; // Duration string (e.g., "PT3M45S" or "3:45")
  number: number; // Track number
  label_percent: number;
  spotify_id?: string;
  lyrics?: string;
  audio_style?: string;
  song_timestamp?: string | Date;
  created_at?: string | Date;
  updated_at?: string | Date;
  // Relations (populated by JOINs)
  mainGenre?: Genre;
  main_genre_name?: string;
  main_genre_en?: string;
  secondaryGenre?: Genre;
  secondary_genre_name?: string;
  secondary_genre_en?: string;
  songLanguage?: Language;
  song_language_code?: string;
  song_language_name?: string;
  lyricsLanguage?: Language;
  lyrics_language_code?: string;
  lyrics_language_name?: string;
  artists?: TrackArtist[];
}

export interface TrackArtist {
  id: number;
  release_track_id: number;
  user_id: number;
  role_id: number;
  percent?: number;
  category?: number;
  created_at?: string | Date;
  updated_at?: string | Date;
  // Relations (populated by JOINs)
  user?: User;
  artist_name?: string;
  stage_name?: string;
  name?: string;
  role?: Role;
  role_name?: string;
  role_category?: number;
}

// =============================================
// DDEX COMPOSITE TYPES
// =============================================

export interface ReleaseWithDetails {
  release: Release;
  tracks: Track[];
  // Main artist is in release.mainArtist
  // Track artists are in tracks[].artists[]
}

// =============================================
// DDEX ROLE MAPPING
// =============================================

/**
 * Maps TrankYouTV role names to DDEX standard roles
 */
export const ROLE_TO_DDEX_MAP: Record<string, string> = {
  // Spanish mappings
  'Artista': 'MainArtist',
  'Compositor': 'Composer',
  'Productor': 'Producer',
  'Mezclador': 'MixingEngineer',
  'Arreglista': 'Arranger',
  'Ingeniero de sonido': 'Engineer',
  'Director de música': 'MusicDirector',
  'Ingeniero Maestro': 'MasteringEngineer',
  'Coro': 'Choir',
  'Orquesta': 'Orchestra',
  'Solista': 'Soloist',
  'Director de video': 'VideoDirector',
  'Productor de video': 'VideoProducer',
  'Liricista': 'Lyricist',
  'Editor': 'Editor',
  
  // English mappings
  'artist': 'MainArtist',
  'Artist': 'MainArtist',
  'Composer': 'Composer',
  'Producer': 'Producer',
  'Featuring': 'FeaturedArtist',
  'Featured': 'FeaturedArtist',
  'Primary': 'MainArtist',
  'Remixer': 'Remixer',
  'DJ': 'DJ',
  'Lyricist': 'Lyricist',
  'Mixer': 'Mixer',
  'Engineer': 'Engineer',
  'Arranger': 'Arranger',
  
  // Role categories from your data
  'admin': 'Producer',
  'Participante': 'Contributor',
  'Sello Discográfico': 'RecordLabel',
  'Artista Invitado': 'FeaturedArtist',
  
  // Default fallback
  'Otro': 'Contributor',
};

/**
 * Maps explicit status values to DDEX ParentalWarningType
 */
export const EXPLICIT_STATUS_MAP: Record<string, string> = {
  'explicit': 'Explicit',
  'clean': 'NotExplicit',
  'edited': 'Edited',
  '': 'Unknown',
};

/**
 * Maps mix version names to DDEX VersionType
 */
export const MIX_VERSION_MAP: Record<string, string> = {
  'remix': 'Remix',
  'acoustic': 'Acoustic',
  'live': 'Live',
  'instrumental': 'Instrumental',
  'acapella': 'Acapella',
  'extended': 'Extended',
  'radio': 'RadioEdit',
  'demo': 'Demo',
};

// =============================================
// HELPER TYPES (kept for backwards compatibility)
// =============================================

export type ArtistRole =
  | 'MainArtist'
  | 'FeaturedArtist'
  | 'Producer'
  | 'Composer'
  | 'Lyricist'
  | 'Remixer'
  | 'Mixer'
  | 'Engineer'
  | 'Arranger'
  | 'Contributor';

/**
 * DDEX Message Header Information
 */
export interface MessageHeader {
  messageId: string;
  messageThreadId?: string;
  sentDateTime: string;
  senderPartyId: string;
  senderPartyName: string;
  recipientPartyId?: string;
  recipientPartyName?: string;
}

/**
 * Deal/License Information
 */
export interface Deal {
  territoryCode: string; // ISO 3166-1 alpha-2
  startDate?: string;
  endDate?: string;
  useType: 'PermanentDownload' | 'OnDemandStream' | 'ConditionalDownload' | 'UserMadeClip';
  commercialModelType?: string;
  priceType?: string;
  priceValue?: number;
  priceCurrency?: string;
}
