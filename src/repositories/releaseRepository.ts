import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db';
import { Release, Track, TrackArtist, ReleaseWithDetails } from '../types/ddex';

/**
 * Fetch release metadata by ID with all relations
 */
export async function getReleaseById(releaseId: number): Promise<Release | null> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        r.*,
        l.name as label_name,
        l.logo as label_logo,
        l.cline as label_cline,
        l.pline as label_pline,
        rt.name as release_type_name,
        u.artist_name,
        u.artist_name as stage_name,
        u.name as user_name
      FROM releases r
      LEFT JOIN labels l ON r.label_id = l.id
      LEFT JOIN release_types rt ON r.release_type_id = rt.id
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.id = ?`,
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
 * Fetch all tracks for a given release with genres and languages
 */
export async function getTracksByReleaseId(releaseId: number): Promise<Track[]> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        t.*,
        mg.name as main_genre_name,
        mg.name_en as main_genre_en,
        sg.name as secondary_genre_name,
        sg.name_en as secondary_genre_en,
        sl.code as song_language_code,
        sl.name as song_language_name,
        ll.code as lyrics_language_code,
        ll.name as lyrics_language_name,
        t.sound_path as sound_url
      FROM release_tracks t
      LEFT JOIN music_genders mg ON t.main_gender_id = mg.id
      LEFT JOIN music_genders sg ON t.secondary_gender_id = sg.id
      LEFT JOIN languages sl ON t.song_language_id = sl.id
      LEFT JOIN languages ll ON t.lyrics_language_id = ll.id
      WHERE t.release_id = ?
      ORDER BY t.number ASC`,
      [releaseId]
    );

    return rows as Track[];
  } catch (error) {
    console.error('Error fetching tracks:', error);
    throw new Error('Failed to fetch tracks from database');
  }
}

/**
 * Fetch all artists for specific tracks with their roles
 */
export async function getTrackArtists(trackIds: number[]): Promise<TrackArtist[]> {
  try {
    if (trackIds.length === 0) {
      return [];
    }

    const placeholders = trackIds.map(() => '?').join(',');
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        ta.*,
        u.artist_name,
        u.artist_name as stage_name,
        u.name,
        r.name as role_name,
        r.category as role_category
      FROM release_track_artists ta
      INNER JOIN users u ON ta.user_id = u.id
      INNER JOIN roles r ON ta.role_id = r.id
      WHERE ta.release_track_id IN (${placeholders})
      ORDER BY ta.release_track_id, ta.id`,
      trackIds
    );

    return rows as TrackArtist[];
  } catch (error) {
    console.error('Error fetching track artists:', error);
    throw new Error('Failed to fetch track artists from database');
  }
}

/**
 * Group track artists by track ID
 */
function groupArtistsByTrack(artists: TrackArtist[]): Map<number, TrackArtist[]> {
  const grouped = new Map<number, TrackArtist[]>();
  
  for (const artist of artists) {
    const trackId = artist.release_track_id;
    if (!grouped.has(trackId)) {
      grouped.set(trackId, []);
    }
    grouped.get(trackId)!.push(artist);
  }
  
  return grouped;
}

/**
 * Fetch complete release with all related data
 */
export async function getReleaseWithDetails(releaseId: number): Promise<ReleaseWithDetails | null> {
  try {
    // Fetch release
    const release = await getReleaseById(releaseId);
    
    if (!release) {
      return null;
    }

    // Fetch tracks
    const tracks = await getTracksByReleaseId(releaseId);

    if (tracks.length === 0) {
      return {
        release,
        tracks: [],
      };
    }

    // Fetch track artists
    const trackIds = tracks.map(t => t.id);
    const trackArtists = await getTrackArtists(trackIds);
    
    // Group artists by track
    const artistsByTrack = groupArtistsByTrack(trackArtists);
    
    // Attach artists to their tracks
    for (const track of tracks) {
      track.artists = artistsByTrack.get(track.id) || [];
    }

    return {
      release,
      tracks,
    };
  } catch (error) {
    console.error('Error fetching release with details:', error);
    throw new Error('Failed to fetch complete release data');
  }
}
