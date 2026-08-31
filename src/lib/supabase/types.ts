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
  parent_trip_id: string | null;
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
  journey_id: string | null;
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
  event_type: "level_up" | "steps" | "unlock" | "gacha" | "login" | "item_catch" | "wanko_bowling" | "snack_trail";
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

export type PersonalRecordTripRow = {
  trip_id: string;
  title: string;
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

export type FriendActivityRow = {
  friend_user_id: string;
  display_name: string;
  profile_image_url: string | null;
  spot_name: string;
  prefecture_code: string;
  municipality_code: string;
  registered_at: string;
};

export type FriendStepsRankingRow = {
  friend_user_id: string;
  display_name: string;
  profile_image_url: string | null;
  steps: number;
};

export type NoticeType = "friend_spot" | "minigame_best" | "steps_10000" | "collection_rare" | "admin";

export type NoticeFeedRow = {
  id: string;
  type: NoticeType;
  created_at: string;
  display_name: string | null;
  avatar_url: string | null;
  title: string;
  content: string | null;
  is_read: boolean;
  /** Storageのパス（未解決）。運営お知らせ以外は常にnull */
  image_path: string | null;
  /** 外部リンクURL。運営お知らせ以外は常にnull */
  link_url: string | null;
  /** 添付HTMLファイルのStorageパス（未解決）。運営お知らせ以外は常にnull */
  html_path: string | null;
};

export type NoticeDetailRow = {
  id: string;
  type: NoticeType;
  created_at: string;
  display_name: string | null;
  avatar_url: string | null;
  title: string;
  content: string | null;
  is_read: boolean;
  /** Storageのパス（未解決）。運営お知らせ以外は常にnull */
  image_path: string | null;
  /** 外部リンクURL。運営お知らせ以外は常にnull */
  link_url: string | null;
  /** 添付HTMLファイルのStorageパス（未解決）。運営お知らせ以外は常にnull */
  html_path: string | null;
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

export type SnsFeedPhotoRow = {
  id: string;
  user_id: string;
  display_name: string;
  profile_image_url: string | null;
  photo_date: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
  my_reaction: string | null;
  reaction_count: number;
  comment_count: number;
};

export type SnsCommentRow = {
  id: string;
  photo_id: string;
  user_id: string;
  display_name: string;
  profile_image_url: string | null;
  body: string;
  created_at: string;
};

export type SnsPhotoRow = SnsFeedPhotoRow & {
  group_id: string | null;
  group_name: string | null;
};

export type SnsMentionRow = {
  user_id: string;
  display_name: string;
};

export type SnsTextPostRow = {
  id: string;
  user_id: string;
  display_name: string;
  profile_image_url: string | null;
  body: string;
  photo_paths: string[];
  linked_visit_id: string | null;
  linked_spot_id: string | null;
  linked_spot_name: string | null;
  linked_trip_id: string | null;
  linked_trip_title: string | null;
  linked_visited_at: string | null;
  created_at: string;
  reply_count: number;
  like_count: number;
  my_liked: boolean;
  my_saved: boolean;
  is_pinned: boolean;
  repost_count: number;
  my_reposted: boolean;
  repost_of_post_id: string | null;
  quoted_user_id: string | null;
  quoted_display_name: string | null;
  quoted_profile_image_url: string | null;
  quoted_body: string | null;
  quoted_photo_paths: string[];
  quoted_linked_spot_id: string | null;
  quoted_linked_spot_name: string | null;
  quoted_linked_trip_id: string | null;
  quoted_linked_trip_title: string | null;
  quoted_linked_visited_at: string | null;
  quoted_created_at: string | null;
  mentions: SnsMentionRow[];
};

export type SnsTextPostReplyRow = {
  id: string;
  post_id: string;
  parent_reply_id: string | null;
  user_id: string;
  display_name: string;
  profile_image_url: string | null;
  body: string;
  created_at: string;
  like_count: number;
  my_liked: boolean;
  mentions: SnsMentionRow[];
};

export type FriendGroupRow = {
  id: string;
  name: string;
  icon: string;
  icon_path: string | null;
  owner_id: string;
  member_count: number;
  created_at: string;
  has_unread: boolean;
};

export type FriendGroupSummaryRow = FriendGroupRow & {
  unread_count: number;
  latest_kind: "photo" | "message" | null;
  latest_preview: string | null;
  latest_actor_name: string | null;
  latest_at: string | null;
};

export type FriendGroupMemberRow = {
  user_id: string;
  display_name: string;
  profile_image_url: string | null;
  is_owner: boolean;
};

export type FriendGroupMessageRow = {
  id: string;
  group_id: string;
  user_id: string;
  display_name: string;
  profile_image_url: string | null;
  body: string;
  created_at: string;
  mentions: SnsMentionRow[];
};

export type FriendGroupPinRow = {
  group_id: string;
  title: string;
  body: string;
  updated_by_name: string;
  updated_at: string;
};

export type FriendGroupPollRow = {
  id: string;
  group_id: string;
  user_id: string;
  display_name: string;
  question: string;
  closes_at: string | null;
  created_at: string;
  option_ids: string[];
  option_labels: string[];
  option_vote_counts: number[];
  my_option_id: string | null;
  total_votes: number;
};

export type SnsBlockedUserRow = {
  user_id: string;
  display_name: string;
  profile_image_url: string | null;
  blocked_at: string;
};

export type SnsMentionNotificationRow = {
  id: string;
  kind: "post" | "reply" | "group";
  post_id: string | null;
  group_id: string | null;
  actor_user_id: string;
  actor_display_name: string;
  actor_profile_image_url: string | null;
  body: string;
  created_at: string;
};

export type FriendMessageRow = {
  id: string;
  user_id: string;
  display_name: string;
  profile_image_url: string | null;
  body: string;
  created_at: string;
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
      get_friends_activity_feed: { Args: { p_limit?: number }; Returns: FriendActivityRow[] };
      get_friends_steps_ranking: { Args: { p_limit?: number }; Returns: FriendStepsRankingRow[] };
      get_notices_feed: { Args: { p_limit?: number }; Returns: NoticeFeedRow[] };
      get_notice_detail: { Args: { p_notice_id: string }; Returns: NoticeDetailRow[] };
      get_unread_notice_count: { Args: Record<string, never>; Returns: number };
      mark_notices_read: { Args: { p_notice_ids: string[] }; Returns: undefined };
      post_admin_notice: {
        Args: {
          p_title: string;
          p_message: string;
          p_image_path?: string | null;
          p_link_url?: string | null;
          p_html_path?: string | null;
        };
        Returns: string;
      };
      update_admin_notice: {
        Args: {
          p_notice_id: string;
          p_title: string;
          p_message: string;
          p_image_path?: string | null;
          p_link_url?: string | null;
          p_html_path?: string | null;
        };
        Returns: undefined;
      };
      delete_admin_notice: { Args: { p_notice_id: string }; Returns: string[] };
      is_notice_admin: { Args: Record<string, never>; Returns: boolean };
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
      leave_shared_trip: {
        Args: { p_trip_id: string };
        Returns: undefined;
      };
      ensure_personal_record_trip: {
        Args: Record<string, never>;
        Returns: PersonalRecordTripRow[];
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
      create_friend_photo: {
        Args: { p_storage_path: string; p_caption?: string | null; p_group_id?: string | null };
        Returns: { id: string; photo_date: string; created_at: string }[];
      };
      delete_friend_photo: { Args: { p_photo_id: string }; Returns: string };
      get_sns_feed: { Args: { p_days?: number }; Returns: SnsFeedPhotoRow[] };
      get_personal_sns_feed: {
        Args: { p_user_id?: string | null; p_days?: number };
        Returns: SnsFeedPhotoRow[];
      };
      create_friend_text_post: {
        Args: {
          p_body: string;
          p_photo_paths?: string[];
          p_visit_record_id?: string | null;
          p_repost_of_post_id?: string | null;
        };
        Returns: { id: string; created_at: string }[];
      };
      delete_friend_text_post: { Args: { p_post_id: string }; Returns: string[] };
      get_personal_text_feed: {
        Args: { p_user_id?: string | null; p_limit?: number };
        Returns: SnsTextPostRow[];
      };
      get_personal_text_post: { Args: { p_post_id: string }; Returns: SnsTextPostRow[] };
      get_saved_friend_text_posts: { Args: { p_limit?: number }; Returns: SnsTextPostRow[] };
      set_friend_text_post_saved: { Args: { p_post_id: string; p_saved: boolean }; Returns: undefined };
      set_friend_text_post_repost: { Args: { p_post_id: string; p_reposted: boolean }; Returns: undefined };
      set_friend_text_post_pin: { Args: { p_post_id: string; p_pinned: boolean }; Returns: undefined };
      get_friend_profile: {
        Args: { p_user_id: string };
        Returns: { display_name: string; profile_image_url: string | null }[];
      };
      set_friend_text_post_like: { Args: { p_post_id: string; p_liked: boolean }; Returns: undefined };
      add_friend_text_post_reply: {
        Args: { p_post_id: string; p_body: string; p_parent_reply_id?: string | null };
        Returns: { id: string; created_at: string }[];
      };
      delete_friend_text_post_reply: { Args: { p_reply_id: string }; Returns: undefined };
      get_friend_text_post_replies: { Args: { p_post_id: string }; Returns: SnsTextPostReplyRow[] };
      get_friend_text_post_replies_batch: { Args: { p_post_ids: string[] }; Returns: SnsTextPostReplyRow[] };
      set_friend_text_post_reply_like: { Args: { p_reply_id: string; p_liked: boolean }; Returns: undefined };
      get_sns_photo: { Args: { p_photo_id: string }; Returns: SnsPhotoRow[] };
      set_friend_photo_reaction: { Args: { p_photo_id: string; p_emoji: string | null }; Returns: undefined };
      add_friend_photo_comment: { Args: { p_photo_id: string; p_body: string }; Returns: SnsCommentRow[] };
      get_friend_photo_comments: { Args: { p_photo_id: string }; Returns: SnsCommentRow[] };
      delete_friend_photo_comment: { Args: { p_comment_id: string }; Returns: undefined };
      create_friend_group: {
        Args: { p_name: string; p_member_user_ids: string[]; p_icon?: string; p_icon_path?: string | null };
        Returns: string;
      };
      update_friend_group: {
        Args: {
          p_group_id: string;
          p_name?: string | null;
          p_icon_path?: string | null;
          p_remove_icon?: boolean;
        };
        Returns: undefined;
      };
      add_friend_group_members: { Args: { p_group_id: string; p_member_user_ids: string[] }; Returns: undefined };
      leave_friend_group: { Args: { p_group_id: string }; Returns: undefined };
      delete_friend_group: { Args: { p_group_id: string }; Returns: undefined };
      get_friend_group_members: { Args: { p_group_id: string }; Returns: FriendGroupMemberRow[] };
      get_my_friend_groups: { Args: Record<string, never>; Returns: FriendGroupRow[] };
      get_my_friend_group_summaries: { Args: Record<string, never>; Returns: FriendGroupSummaryRow[] };
      reorder_friend_groups: { Args: { p_group_ids: string[] }; Returns: undefined };
      mark_friend_group_read: { Args: { p_group_id: string }; Returns: undefined };
      get_sns_group_feed: { Args: { p_group_id: string; p_days?: number }; Returns: SnsFeedPhotoRow[] };
      create_friend_group_message: {
        Args: { p_group_id: string; p_body: string };
        Returns: FriendGroupMessageRow[];
      };
      get_friend_group_messages: {
        Args: { p_group_id: string; p_limit?: number };
        Returns: FriendGroupMessageRow[];
      };
      delete_friend_group_message: { Args: { p_message_id: string }; Returns: undefined };
      set_friend_group_pin: {
        Args: { p_group_id: string; p_title: string; p_body?: string };
        Returns: undefined;
      };
      get_friend_group_pin: { Args: { p_group_id: string }; Returns: FriendGroupPinRow[] };
      create_friend_group_poll: {
        Args: { p_group_id: string; p_question: string; p_options: string[]; p_closes_at?: string | null };
        Returns: string;
      };
      vote_friend_group_poll: { Args: { p_poll_id: string; p_option_id: string }; Returns: undefined };
      delete_friend_group_poll: { Args: { p_poll_id: string }; Returns: undefined };
      get_friend_group_polls: {
        Args: { p_group_id: string; p_limit?: number };
        Returns: FriendGroupPollRow[];
      };
      set_sns_user_block: { Args: { p_user_id: string; p_blocked: boolean }; Returns: undefined };
      get_sns_blocked_users: { Args: Record<string, never>; Returns: SnsBlockedUserRow[] };
      get_sns_hidden_user_ids: {
        Args: Record<string, never>;
        Returns: { user_id: string }[];
      };
      report_sns_post: { Args: { p_post_id: string; p_reason?: string }; Returns: undefined };
      get_sns_mentions: { Args: { p_limit?: number }; Returns: SnsMentionNotificationRow[] };
      get_sns_unread_count: { Args: Record<string, never>; Returns: number };
      create_friend_message: { Args: { p_body: string }; Returns: FriendMessageRow[] };
      get_friend_messages: { Args: { p_limit?: number }; Returns: FriendMessageRow[] };
      delete_friend_message: { Args: { p_message_id: string }; Returns: undefined };
    };
    Enums: {
      location_source: LocationSource;
    };
    CompositeTypes: Record<string, never>;
  };
};
