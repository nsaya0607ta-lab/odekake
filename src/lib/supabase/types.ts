/** スポットの座標をどうやって決めたか */
export type LocationSource = "municipality" | "address" | "map" | "device" | "place_search";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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
  trip_type: "personal" | "shared";
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

export type UserExpRow = {
  user_id: string;
  total_exp: number;
  updated_at: string;
};

export type ExpEventRow = {
  id: string;
  user_id: string;
  event_type:
    | "visit_created"
    | "first_spot"
    | "revisit"
    | "photo"
    | "comment"
    | "rating"
    | "first_municipality"
    | "first_prefecture"
    | "first_region"
    | "municipality_5_spots"
    | "prefecture_5_municipalities"
    | "prefecture_50_percent"
    | "prefecture_100_percent"
    | "steps";
  exp: number;
  idempotency_key: string;
  visit_record_id: string | null;
  spot_id: string | null;
  prefecture_code: string | null;
  municipality_code: string | null;
  event_date: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type UserCoinsRow = {
  user_id: string;
  balance: number;
  total_earned: number;
  updated_at: string;
};

export type CoinEventRow = {
  id: string;
  user_id: string;
  /** unlock は将来のショップ用（現在は付与しない） */
  event_type: "level_up" | "steps" | "unlock" | "gacha" | "login";
  /** 正の値が獲得、負の値が消費 */
  amount: number;
  idempotency_key: string;
  level: number | null;
  event_date: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

/** レベルアップ報酬のうち装着できるもの（首輪・バンダナ・帽子・リュック・クラウン・称号） */
export type EquipmentSlot = "collar" | "bandana" | "hat" | "backpack" | "crown" | "title";

export type UserEquipmentRow = {
  user_id: string;
  slot: EquipmentSlot;
  level: number;
  updated_at: string;
};

export type UserDogSkinRow = {
  user_id: string;
  skin_id: string;
  updated_at: string;
};

/** ガチャで手に入れたもの。item_id は src/lib/gacha/prizes.ts の GachaPrize.id */
export type UserGachaItemRow = {
  user_id: string;
  item_id: string;
  count: number;
  first_obtained_at: string;
  updated_at: string;
};

export type FriendCodeRow = {
  user_id: string;
  code: string;
  created_at: string;
  updated_at: string;
};

export type FriendshipRow = {
  user_id: string;
  friend_user_id: string;
  created_at: string;
};

export type SharedTripListRow = {
  trip_id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_image_url: string | null;
  owner_id: string;
  owner_name: string;
  my_role: "owner" | "member";
  my_status: "invited" | "accepted";
  member_count: number;
  member_names: string[];
  updated_at: string;
};

export type FriendPrivacySettingsRow = {
  user_id: string;
  show_prefectures: boolean;
  show_collection: boolean;
  show_recent_visits: boolean;
  updated_at: string;
};

export type FriendListRow = {
  friend_user_id: string;
  display_name: string;
  profile_image_url: string | null;
  total_exp: number;
  visited_prefectures: number;
  visited_municipalities: number;
  visit_count: number;
  collection_owned_count: number | null;
  show_collection: boolean;
  friend_since: string;
};

export type FriendOverviewRow = {
  friend_user_id: string;
  display_name: string;
  profile_image_url: string | null;
  introduction: string | null;
  total_exp: number;
  visited_prefecture_count: number;
  visited_municipality_count: number;
  visit_count: number;
  show_prefectures: boolean;
  show_collection: boolean;
  show_recent_visits: boolean;
};

export type FriendPrefectureRow = {
  prefecture_code: string;
  visit_count: number;
  last_visited_at: string;
};

export type FriendCollectionRow = {
  item_id: string;
  count: number;
};

export type FriendRecentVisitRow = {
  spot_id: string;
  spot_name: string;
  visited_at: string;
  prefecture_code: string;
  municipality_code: string;
  photo_path: string | null;
};

export type DailyStepsRow = {
  user_id: string;
  step_date: string;
  steps: number;
  earned_exp: number;
  source: string;
  created_at: string;
  updated_at: string;
};

export type StepsSyncTokenRow = {
  user_id: string;
  token: string;
  created_at: string;
  updated_at: string;
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
      user_exp: {
        Row: UserExpRow;
        Insert: Partial<UserExpRow> & { user_id: string };
        Update: Partial<UserExpRow>;
        Relationships: [];
      };
      exp_events: {
        Row: ExpEventRow;
        Insert: Partial<ExpEventRow> & {
          user_id: string;
          event_type: ExpEventRow["event_type"];
          exp: number;
          idempotency_key: string;
        };
        Update: Partial<ExpEventRow>;
        Relationships: [];
      };
      user_coins: {
        Row: UserCoinsRow;
        Insert: Partial<UserCoinsRow> & { user_id: string };
        Update: Partial<UserCoinsRow>;
        Relationships: [];
      };
      coin_events: {
        Row: CoinEventRow;
        Insert: Partial<CoinEventRow> & {
          user_id: string;
          event_type: CoinEventRow["event_type"];
          amount: number;
          idempotency_key: string;
        };
        Update: Partial<CoinEventRow>;
        Relationships: [];
      };
      user_equipment: {
        Row: UserEquipmentRow;
        Insert: Partial<UserEquipmentRow> & { user_id: string; slot: EquipmentSlot; level: number };
        Update: Partial<UserEquipmentRow>;
        Relationships: [];
      };
      user_dog_skin: {
        Row: UserDogSkinRow;
        Insert: Partial<UserDogSkinRow> & { user_id: string; skin_id: string };
        Update: Partial<UserDogSkinRow>;
        Relationships: [];
      };
      user_gacha_items: {
        Row: UserGachaItemRow;
        Insert: Partial<UserGachaItemRow> & { user_id: string; item_id: string };
        Update: Partial<UserGachaItemRow>;
        Relationships: [];
      };
      friend_codes: {
        Row: FriendCodeRow;
        Insert: Partial<FriendCodeRow> & { user_id: string; code: string };
        Update: Partial<FriendCodeRow>;
        Relationships: [];
      };
      friendships: {
        Row: FriendshipRow;
        Insert: FriendshipRow;
        Update: Partial<FriendshipRow>;
        Relationships: [];
      };
      friend_privacy_settings: {
        Row: FriendPrivacySettingsRow;
        Insert: Partial<FriendPrivacySettingsRow> & { user_id: string };
        Update: Partial<FriendPrivacySettingsRow>;
        Relationships: [];
      };
      daily_steps: {
        Row: DailyStepsRow;
        Insert: Partial<DailyStepsRow> & { user_id: string; step_date: string; steps: number };
        Update: Partial<DailyStepsRow>;
        Relationships: [];
      };
      steps_sync_tokens: {
        Row: StepsSyncTokenRow;
        Insert: Partial<StepsSyncTokenRow> & { user_id: string; token: string };
        Update: Partial<StepsSyncTokenRow>;
        Relationships: [];
      };
      prefecture_municipality_totals: {
        Row: { prefecture_code: string; municipality_count: number };
        Insert: { prefecture_code: string; municipality_count: number };
        Update: Partial<{ municipality_count: number }>;
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
      claim_login_bonus: { Args: Record<string, never>; Returns: Json };
      commit_gacha_draw: {
        Args: { p_cost: number; p_request_id: string; p_item_ids: string[] };
        Returns: Json;
      };
      create_steps_sync_token: { Args: Record<string, never>; Returns: string };
      get_or_create_friend_code: { Args: Record<string, never>; Returns: string };
      get_friends_health: { Args: Record<string, never>; Returns: Json };
      regenerate_friend_code: { Args: Record<string, never>; Returns: string };
      add_friend_by_code: { Args: { p_code: string }; Returns: string };
      remove_friend: { Args: { p_friend_user_id: string }; Returns: undefined };
      get_friend_list: { Args: Record<string, never>; Returns: FriendListRow[] };
      get_friend_overview: {
        Args: { p_friend_user_id: string };
        Returns: FriendOverviewRow[];
      };
      get_friend_prefectures: {
        Args: { p_friend_user_id: string };
        Returns: FriendPrefectureRow[];
      };
      get_friend_collection: {
        Args: { p_friend_user_id: string };
        Returns: FriendCollectionRow[];
      };
      get_friend_recent_visits: {
        Args: { p_friend_user_id: string; p_limit?: number };
        Returns: FriendRecentVisitRow[];
      };
      get_shared_trips_health: { Args: Record<string, never>; Returns: Json };
      get_shared_trip_list: { Args: Record<string, never>; Returns: SharedTripListRow[] };
      create_shared_trip: {
        Args: {
          p_title: string;
          p_friend_user_ids: string[];
          p_start_date?: string | null;
          p_end_date?: string | null;
          p_description?: string | null;
        };
        Returns: string;
      };
      respond_shared_trip_invitation: {
        Args: { p_trip_id: string; p_accept: boolean };
        Returns: undefined;
      };
      delete_own_account: { Args: Record<string, never>; Returns: undefined };
      record_daily_steps: { Args: { p_step_date: string; p_steps: number }; Returns: number };
      record_daily_steps_with_token: {
        Args: { p_token: string; p_step_date: string; p_steps: number };
        Returns: number;
      };
      revoke_steps_sync_token: { Args: Record<string, never>; Returns: undefined };
      set_dog_skin: { Args: { p_skin_id: string }; Returns: undefined };
      set_equipped_item: { Args: { p_slot: string; p_level: number | null }; Returns: undefined };
    };
    Enums: {
      location_source: LocationSource;
    };
    CompositeTypes: Record<string, never>;
  };
};
