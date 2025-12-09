import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db';
import { Release, Track, Artist, ReleaseWithDetails } from '../types/ddex';

/**
 * Fetch release metadata by ID
 */
export async function getReleaseById(releaseId: number): Promise<Release | null> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        id,
        title,
        release_type as releaseType,
        label_name as labelName,
        release_date as releaseDate,
        upc,
        cover_art_url as coverArtUrl,
        c_line as cLine,
        p_line as pLine
      FROM releases
      WHERE id = ?`,
      [releaseId]
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0] as Release;
  } catch (error) {
    console.error('Error fetching release:', error);
    throw new Error('Failed to fetch release from database');
  }
}

/**
 * Fetch all tracks for a given release
 */
export async function getTracksByReleaseId(releaseId: number): Promise<Track[]> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        id,
        release_id as releaseId,
        title,
        duration,
        isrc,
        audio_file_url as audioFileUrl,
        track_number as trackNumber,
        genre
      FROM tracks
      WHERE release_id = ?
      ORDER BY track_number ASC`,
      [releaseId]
    );

    return rows as Track[];
  } catch (error) {
    console.error('Error fetching tracks:', error);
    throw new Error('Failed to fetch tracks from database');
  }
}

/**
 * Fetch all artists associated with a release
 */
export async function getArtistsByReleaseId(releaseId: number): Promise<Artist[]> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        a.id,
        a.name,
        ra.role,
        ra.release_id as releaseId,
        ra.track_id as trackId
      FROM artists a
      INNER JOIN release_artists ra ON a.id = ra.artist_id
      WHERE ra.release_id = ?`,
      [releaseId]
    );

    return rows as Artist[];
  } catch (error) {
    console.error('Error fetching artists:', error);
    throw new Error('Failed to fetch artists from database');
  }
}

/**
 * Fetch complete release with all related data
 */
export async function getReleaseWithDetails(releaseId: number): Promise<ReleaseWithDetails | null> {
  try {
    const release = await getReleaseById(releaseId);
    
    if (!release) {
      return null;
    }

    const [tracks, artists] = await Promise.all([
      getTracksByReleaseId(releaseId),
      getArtistsByReleaseId(releaseId),
    ]);

    return {
      release,
      tracks,
      artists,
    };
  } catch (error) {
    console.error('Error fetching release with details:', error);
    throw new Error('Failed to fetch complete release data');
  }
}

