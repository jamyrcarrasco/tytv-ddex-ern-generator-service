/**
 * DDEX ERN 3.8.2 Type Definitions
 */

export interface Release {
  id: number;
  title: string;
  releaseType: 'Album' | 'Single' | 'EP';
  labelName: string;
  releaseDate: string; // ISO 8601 format (YYYY-MM-DD)
  upc: string; // Universal Product Code
  coverArtUrl?: string;
  cLine?: string; // Copyright line
  pLine?: string; // Phonographic copyright line
}

export interface Track {
  id: number;
  releaseId: number;
  title: string;
  duration: string; // ISO 8601 duration format (PT3M45S)
  isrc: string; // International Standard Recording Code
  audioFileUrl: string;
  trackNumber: number;
  genre?: string;
}

export type ArtistRole =
  | 'MainArtist'
  | 'FeaturedArtist'
  | 'Producer'
  | 'Composer'
  | 'Lyricist'
  | 'Remixer';

export interface Artist {
  id: number;
  name: string;
  role: ArtistRole;
  releaseId?: number;
  trackId?: number;
}

export interface ReleaseWithDetails {
  release: Release;
  tracks: Track[];
  artists: Artist[];
}

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
  useType: 'PermanentDownload' | 'OnDemandStream' | 'ConditionalDownload';
  priceType?: string;
  priceValue?: number;
  priceCurrency?: string;
}

