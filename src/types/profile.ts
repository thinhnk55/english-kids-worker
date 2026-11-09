export interface EnglishKidsProfile {
  id: number;
  user_id: number;
  name: string;
  avatar: string | null;
  birth_year: number | null;
  gender: string | null;
  position: number;
  created_at: number;
  updated_at: number;
}

export interface EnglishKidsParent {
  user_id: number;
  default_profile: number | null;
  max_profiles: number;
  created_at: number;
  updated_at: number;
}
