import { supabase } from '@/lib/supabase';
import { isEssayDocument, isSimulationSession } from '@/lib/user-sync';
import type { EssayDocument, SimulationSession } from '@/types';

const AVATAR_BUCKET = 'profile-avatars';
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export type ProfileAvatarAsset = {
  uri: string;
  base64?: string | null;
  mimeType?: string | null;
};

function decodeBase64(value: string): ArrayBuffer {
  const clean = value.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const outputLength = Math.floor((clean.length * 3) / 4) - (clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0);
  if (outputLength <= 0 || outputLength > MAX_AVATAR_BYTES) throw new Error('Imagem inválida ou muito grande.');
  const bytes = new Uint8Array(outputLength);
  let outputIndex = 0;
  for (let index = 0; index < clean.length; index += 4) {
    const a = alphabet.indexOf(clean[index]);
    const b = alphabet.indexOf(clean[index + 1]);
    const c = clean[index + 2] === '=' ? 0 : alphabet.indexOf(clean[index + 2]);
    const d = clean[index + 3] === '=' ? 0 : alphabet.indexOf(clean[index + 3]);
    if (a < 0 || b < 0 || c < 0 || d < 0) throw new Error('Formato de imagem inválido.');
    const combined = (a << 18) | (b << 12) | (c << 6) | d;
    if (outputIndex < outputLength) bytes[outputIndex++] = (combined >> 16) & 255;
    if (outputIndex < outputLength) bytes[outputIndex++] = (combined >> 8) & 255;
    if (outputIndex < outputLength) bytes[outputIndex++] = combined & 255;
  }
  return bytes.buffer;
}

function avatarExtension(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

export function profileAvatarUrl(path?: string | null, version?: string | null): string | undefined {
  if (!supabase || !path) return undefined;
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return version ? `${data.publicUrl}?v=${encodeURIComponent(version)}` : data.publicUrl;
}

export async function uploadRemoteAvatar(
  userId: string,
  base64: string,
  mimeType = 'image/jpeg'
): Promise<string> {
  if (!supabase) throw new Error('Supabase não configurado.');
  if (!ALLOWED_AVATAR_TYPES.has(mimeType)) throw new Error('Formato de imagem não permitido.');
  const path = `${userId}/avatar.${avatarExtension(mimeType)}`;
  const bytes = decodeBase64(base64);
  const currentProfile = await supabase
    .from('profiles')
    .select('avatar_path')
    .eq('id', userId)
    .maybeSingle();
  if (currentProfile.error) throw currentProfile.error;
  const upload = await supabase.storage.from(AVATAR_BUCKET).upload(path, bytes, {
    contentType: mimeType,
    cacheControl: '3600',
    upsert: true,
  });
  if (upload.error) throw upload.error;

  const profile = await supabase
    .from('profiles')
    .update({ avatar_path: path })
    .eq('id', userId)
    .select('updated_at')
    .single();
  if (profile.error) throw profile.error;
  if (currentProfile.data?.avatar_path && currentProfile.data.avatar_path !== path) {
    await supabase.storage
      .from(AVATAR_BUCKET)
      .remove([currentProfile.data.avatar_path])
      .catch(() => undefined);
  }
  return profileAvatarUrl(path, profile.data.updated_at) ?? '';
}

export async function loadRemoteEssay(userId: string, topicId: string): Promise<EssayDocument | null> {
  if (!supabase) return null;
  const result = await supabase
    .from('essay_documents')
    .select('topic_id, content, elapsed_seconds, status, submitted_at, updated_at')
    .eq('user_id', userId)
    .eq('topic_id', topicId)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) return null;
  const document: EssayDocument = {
    topicId: result.data.topic_id,
    content: result.data.content,
    elapsedSeconds: result.data.elapsed_seconds,
    status: result.data.status as EssayDocument['status'],
    submittedAt: result.data.submitted_at ?? undefined,
    updatedAt: result.data.updated_at,
  };
  return isEssayDocument(document) ? document : null;
}

export async function saveRemoteEssay(userId: string, document: EssayDocument): Promise<void> {
  if (!supabase || !isEssayDocument(document)) return;
  const result = await supabase.rpc('sync_essay_document', {
    p_user_id: userId,
    p_topic_id: document.topicId,
    p_content: document.content,
    p_elapsed_seconds: document.elapsedSeconds,
    p_status: document.status,
    p_submitted_at:
      document.status === 'submitted' ? document.submittedAt ?? document.updatedAt : null,
    p_updated_at: document.updatedAt,
  });
  if (result.error) throw result.error;
}

export async function loadRemoteSimulationSessions(userId: string): Promise<SimulationSession[]> {
  if (!supabase) return [];
  const result = await supabase
    .from('simulation_sessions')
    .select('payload, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (result.error) throw result.error;
  return (result.data ?? [])
    .map((row) => ({ ...(row.payload as SimulationSession), updatedAt: row.updated_at }))
    .filter(isSimulationSession);
}

export async function saveRemoteSimulationSession(userId: string, session: SimulationSession): Promise<void> {
  if (!supabase || !isSimulationSession(session)) return;
  const payload = { ...session, updatedAt: session.updatedAt ?? new Date().toISOString() };
  const result = await supabase.rpc('sync_simulation_session', {
    p_user_id: userId,
    p_session_id: session.id,
    p_status: session.status,
    p_payload: payload,
    p_created_at: session.createdAt,
    p_completed_at: session.status === 'completed' ? session.completedAt : null,
    p_updated_at: payload.updatedAt,
  });
  if (result.error) throw result.error;
}

export async function deleteRemoteSimulationSessions(userId: string, sessionId?: string): Promise<void> {
  if (!supabase) return;
  let query = supabase.from('simulation_sessions').delete().eq('user_id', userId);
  if (sessionId) query = query.eq('session_id', sessionId);
  const result = await query;
  if (result.error) throw result.error;
}
