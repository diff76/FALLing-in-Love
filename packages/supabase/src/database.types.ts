/**
 * Hand-maintained types for the approved schema (supabase/migrations/0001_init.sql).
 * Regenerate with `supabase gen types typescript` once the CLI is installed; keep the
 * RPC return shapes below in sync with the SQL.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type StaffRoleRow = { profile_id: string; role: "staff" | "desk" | "admin" };

export type ReservationRow = {
  id: string;
  code: string;
  kind: "host" | "guest_self";
  applicant_name: string;
  phone: string;
  phone_last4: string;
  district_code: string | null;
  inviter_name: string | null;
  age_group: string | null;
  party_size: number;
  transport: "shuttle" | "car" | "other";
  outbound_run_id: string | null;
  return_run_id: string | null;
  vehicle_plate: string | null;
  mobility_support: boolean;
  mobility_note: string | null;
  dietary_note: string | null;
  privacy_consent: boolean;
  contact_consent: boolean;
  status: "active" | "cancelled";
  created_at: string;
  updated_at: string;
};

export type ShuttleRunRow = { id: string; direction: "outbound" | "return"; departs_at: string; label: string; capacity: number | null; active: boolean };
export type StationRow = { id: string; code: string; name: string };
export type CheckinRow = {
  id: string; reservation_id: string; station_id: string; staff_id: string | null;
  arrived_count: number; method: "qr" | "manual"; checked_in_at: string; voided_at: string | null; note: string | null;
};
export type HospitalityItemRow = { id: string; code: string; name: string; initial_stock: number; adjustment: number };
export type SeatAssignmentRow = { reservation_id: string; block: string; seat_from: number; seat_to: number; assigned_at: string };

export type PassLookup = {
  code: string;
  applicant_name: string;
  kind: "host" | "guest_self";
  inviter_name: string | null;
  district_label: string | null;
  party_size: number;
  guest_count: number;
  seat_label: string | null;
  transport: "shuttle" | "car" | "other";
  outbound_label: string | null;
  return_label: string | null;
  mobility_support: boolean;
  has_dietary_note: boolean;
  vehicle_plate: string | null;
  issued_at: string;
};

export type ReservationSummary = {
  id: string;
  code: string;
  applicant_name: string;
  district_label: string | null;
  party_size: number;
  guest_count: number;
  seat_label: string | null;
  transport: string;
  outbound_label: string | null;
  return_label: string | null;
  mobility_support: boolean;
  mobility_note: string | null;
  dietary_note: string | null;
  vehicle_plate: string | null;
  checkin: null | { id: string; arrived_count: number; station_name: string; checked_in_at: string };
};

export type CheckinResult = {
  already: boolean;
  checkin_id: string;
  arrived_count: number;
  station_name: string;
  checked_in_at: string;
  applicant_name: string;
  seat_label: string | null;
};

export type OpsStats = {
  reservations: number;
  people: number;
  guests: number;
  checked_in_parties: number;
  checked_in_people: number;
  contact_consent_people: number;
  mobility_parties: number;
  dietary_parties: number;
  by_district: { label: string; people: number; arrived: number }[];
  by_run: { label: string; people: number }[];
  by_station: { name: string; arrived: number }[];
};

export type Database = {
  public: {
    Tables: {
      profiles: { Row: { id: string; display_name: string | null; created_at: string }; Insert: { id: string; display_name?: string | null }; Update: { display_name?: string | null }; Relationships: [] };
      staff_roles: { Row: StaffRoleRow; Insert: StaffRoleRow; Update: Partial<StaffRoleRow>; Relationships: [] };
      reservations: { Row: ReservationRow; Insert: Partial<ReservationRow>; Update: Partial<ReservationRow>; Relationships: [] };
      shuttle_runs: { Row: ShuttleRunRow; Insert: Partial<ShuttleRunRow>; Update: Partial<ShuttleRunRow>; Relationships: [] };
      stations: { Row: StationRow; Insert: Partial<StationRow>; Update: Partial<StationRow>; Relationships: [] };
      checkins: { Row: CheckinRow; Insert: Partial<CheckinRow>; Update: Partial<CheckinRow>; Relationships: [] };
      hospitality_items: { Row: HospitalityItemRow; Insert: Partial<HospitalityItemRow>; Update: Partial<HospitalityItemRow>; Relationships: [] };
      seat_assignments: { Row: SeatAssignmentRow; Insert: Partial<SeatAssignmentRow>; Update: Partial<SeatAssignmentRow>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      create_reservation: { Args: { payload: Json; token_hash: string }; Returns: { reservation_id: string; code: string; seat_label: string } };
      lookup_pass: { Args: { p_token_hash: string }; Returns: PassLookup | null };
      find_reservations: { Args: { p_query: string }; Returns: ReservationSummary[] };
      get_reservation_summary: { Args: { p_reservation_id: string }; Returns: ReservationSummary | null };
      lookup_reservation_by_pass: { Args: { p_token_hash: string }; Returns: ReservationSummary | null };
      perform_checkin: { Args: { p_reservation_id: string; p_station_code: string; p_arrived_count: number; p_method: string; p_distributions: Json }; Returns: CheckinResult };
      ops_stats: { Args: Record<string, never>; Returns: OpsStats };
      my_roles: { Args: Record<string, never>; Returns: string[] };
    };
    Enums: { staff_role: "staff" | "desk" | "admin" };
    CompositeTypes: Record<string, never>;
  };
};
