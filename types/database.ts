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
