/** スポットの座標をどうやって決めたか */
export type LocationSource = "municipality" | "address" | "map" | "device" | "place_search";

export type ProfileRow = {
  id: string;
  user_id: string;
  display_name: string;
  profile_image_url: string | null;
  introduction: string | null;
  /** ホームや記録画面の上に出す、自分の記録全体の名前。未設定なら「自分の旅」 */
  space_name: string | null;
  created_at: string;
  updated_at: string;
};

export type CategoryRow = {
  id: number;
  name: string;
  icon: string;
  display_order: number;
  active: boolean;
};

export type TripRow = {
  id: string;
  owner_id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type SpotRow = {
  id: string;
  created_by: string;
  name: string;
  category_id: number | null;
  prefecture_code: string;
  municipality_code: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  website_url: string | null;
  opening_hours: string | null;
  closed_days: string | null;
  memo: string | null;
  location_source: LocationSource;
  location_accuracy_m: number | null;
  location_updated_at: string | null;
  place_provider: string | null;
  place_id: string | null;
  postal_code: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

export type VisitRecordRow = {
  id: string;
  user_id: string;
  trip_id: string;
  spot_id: string;
  visited_at: string;
  rating: number | null;
  comment: string | null;
  note: string | null;
  companions: string | null;
  amount: number | null;
  stay_minutes: number | null;
  congestion_level: number | null;
  revisit_wanted: boolean;
  favorite: boolean;
  created_at: string;
  updated_at: string;
};

export type VisitPhotoRow = {
  id: string;
  user_id: string;
  visit_record_id: string;
  storage_path: string;
  caption: string | null;
  display_order: number;
  created_at: string;
};

export type TagRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type AreaStatsRow = {
  prefecture_code: string;
  municipality_code: string;
  spot_count: number;
  visit_count: number;
  favorite_count: number;
  last_visited_at: string | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: { Row: ProfileRow; Insert: Partial<ProfileRow> & { user_id: string }; Update: Partial<ProfileRow>; Relationships: [] };
      categories: { Row: CategoryRow; Insert: CategoryRow; Update: Partial<CategoryRow>; Relationships: [] };
      trips: {
        Row: TripRow;
        Insert: Partial<TripRow> & { owner_id: string; title: string };
        Update: Partial<TripRow>;
        Relationships: [];
      };
      spots: {
        Row: SpotRow;
        Insert: Partial<SpotRow> & {
          created_by: string;
          name: string;
          prefecture_code: string;
          municipality_code: string;
        };
        Update: Partial<SpotRow>;
        Relationships: [];
      };
      visit_records: {
        Row: VisitRecordRow;
        Insert: Partial<VisitRecordRow> & {
          user_id: string;
          trip_id: string;
          spot_id: string;
          visited_at: string;
        };
        Update: Partial<VisitRecordRow>;
        Relationships: [];
      };
      visit_photos: {
        Row: VisitPhotoRow;
        Insert: Partial<VisitPhotoRow> & { user_id: string; visit_record_id: string; storage_path: string };
        Update: Partial<VisitPhotoRow>;
        Relationships: [];
      };
      tags: { Row: TagRow; Insert: Partial<TagRow> & { user_id: string; name: string }; Update: Partial<TagRow>; Relationships: [] };
      visit_record_tags: {
        Row: { id: string; visit_record_id: string; tag_id: string };
        Insert: { id?: string; visit_record_id: string; tag_id: string };
        Update: Partial<{ id: string; visit_record_id: string; tag_id: string }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      area_stats: { Args: { p_trip_ids?: string[] }; Returns: AreaStatsRow[] };
      delete_own_account: { Args: Record<string, never>; Returns: undefined };
    };
    Enums: {
      location_source: LocationSource;
    };
    CompositeTypes: Record<string, never>;
  };
};
