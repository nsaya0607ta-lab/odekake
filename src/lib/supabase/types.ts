export type TripType = "solo" | "shared";
export type TripRole = "owner" | "member" | "viewer";
export type InvitationStatus = "pending" | "accepted" | "expired" | "cancelled";

export type ProfileRow = {
  id: string;
  user_id: string;
  display_name: string;
  profile_image_url: string | null;
  introduction: string | null;
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
  trip_type: TripType;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  cover_image_url: string | null;
  invite_code: string | null;
  created_at: string;
  updated_at: string;
};

export type TripMemberRow = {
  id: string;
  trip_id: string;
  user_id: string;
  role: TripRole;
  joined_at: string;
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

export type TripCommentRow = {
  id: string;
  trip_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
};

export type TripInvitationRow = {
  id: string;
  trip_id: string;
  email: string | null;
  invite_code: string;
  status: InvitationStatus;
  expires_at: string;
  created_at: string;
};

export type AreaStatsRow = {
  prefecture_code: string;
  municipality_code: string;
  spot_count: number;
  visit_count: number;
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
      trip_members: {
        Row: TripMemberRow;
        Insert: Partial<TripMemberRow> & { trip_id: string; user_id: string };
        Update: Partial<TripMemberRow>;
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
      trip_comments: {
        Row: TripCommentRow;
        Insert: Partial<TripCommentRow> & { trip_id: string; user_id: string; comment: string };
        Update: Partial<TripCommentRow>;
        Relationships: [];
      };
      trip_invitations: {
        Row: TripInvitationRow;
        Insert: Partial<TripInvitationRow> & { trip_id: string; invite_code: string };
        Update: Partial<TripInvitationRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      area_stats: { Args: Record<string, never>; Returns: AreaStatsRow[] };
      join_trip_by_code: { Args: { p_code: string }; Returns: { trip_id: string; title: string }[] };
      delete_own_account: { Args: Record<string, never>; Returns: undefined };
    };
    Enums: {
      trip_type: TripType;
      trip_role: TripRole;
      invitation_status: InvitationStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
