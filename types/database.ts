export type ProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  auth_provider: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileUpsert = {
  id: string;
  email: string;
  display_name: string | null;
  username?: string | null;
  avatar_url: string | null;
  auth_provider: string | null;
  updated_at?: string;
};

export type SongRow = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type SongVersionRow = {
  id: string;
  song_id: string;
  version_number: number;
  draft_text: string;
  chat_messages: unknown;
  critique: unknown;
  meta: unknown;
  created_at: string;
};
