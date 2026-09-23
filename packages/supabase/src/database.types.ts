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
  attendance: "main" | "worship";
  worship_service: number | null;
  worship_site: "changdong" | "hanshin" | null;
  source: "web" | "import";
  created_at: string;
  updated_at: string;
};

export type ReservationMemberRow = { id: string; reservation_id: string; position: number; name: string; relation: string | null; age_group: string | null; dietary_note: string | null };
export type ShuttleRunRow = { id: string; direction: "outbound" | "return"; departs_at: string; label: string; capacity: number | null; active: boolean };
export type StationRow = { id: string; code: string; name: string };
export type CheckinRow = {
  id: string; reservation_id: string; station_id: string; staff_id: string | null;
  arrived_count: number; method: "qr" | "manual"; checked_in_at: string; voided_at: string | null; note: string | null;
};
export type HospitalityItemRow = { id: string; code: string; name: string; initial_stock: number; adjustment: number };
export type SeatRow = { id: string; floor: 1 | 2; row_label: string; row_index: number; num: number; block: number; wheelchair: boolean };
export type SeatAssignmentRow = { seat_id: string; reservation_id: string; assigned_at: string; assigned_by: string | null; manual: boolean };
export type ParkingStateRow = { id: 1; capacity: number; occupied: number; updated_at: string };
export type VipArrivalRow = { reservation_id: string; arrived_at: string; staff_id: string | null };
/** One chart cell as returned by `seat_map()`: assignment fields are null when free. */
export type SeatMapCell = { id: string; floor: 1 | 2; row: string; rowIndex: number; num: number; block: number; wheelchair: boolean; reservation_id: string | null; code: string | null; name: string | null };
export type ParkingBoard = {
  state: { capacity: number; occupied: number; free: number };
  vehicles: { reservation_id: string; code: string; name: string; plate: string; party_size: number; vip: boolean; district_label: string | null; arrived_at: string | null; checked_in: boolean }[];
};

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
  attendance: "main" | "worship";
  worship_service: number | null;
  worship_site: "changdong" | "hanshin" | null;
  checked_in: boolean;
};

export type ReservationSummary = {
  id: string;
  code: string;
  applicant_name: string;
  kind: "host" | "guest_self";
  district_code: string | null;
  district_label: string | null;
  party_size: number;
  guest_count: number;
  seat_label: string | null;
  seat_ids: string[];
  transport: string;
  outbound_label: string | null;
  return_label: string | null;
  mobility_support: boolean;
  mobility_note: string | null;
  dietary_note: string | null;
  vehicle_plate: string | null;
  attendance: "main" | "worship";
  worship_service: number | null;
  worship_site: "changdong" | "hanshin" | null;
  source: "web" | "import";
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
  main_people: number;
  worship_people: number;
  checked_in_parties: number;
  checked_in_people: number;
  seated_people: number;
  contact_consent_people: number;
  mobility_parties: number;
  dietary_parties: number;
  by_district: { label: string; people: number; arrived: number }[];
  by_run: { label: string; people: number }[];
  by_return: { label: string; people: number }[];
  by_worship: { service: number | null; site: string | null; people: number }[];
  by_station: { name: string; arrived: number }[];
};

export type Database = {
  public: {
    Tables: {
      profiles: { Row: { id: string; display_name: string | null; created_at: string }; Insert: { id: string; display_name?: string | null }; Update: { display_name?: string | null }; Relationships: [] };
      staff_roles: { Row: StaffRoleRow; Insert: StaffRoleRow; Update: Partial<StaffRoleRow>; Relationships: [] };
      reservations: { Row: ReservationRow; Insert: Partial<ReservationRow>; Update: Partial<ReservationRow>; Relationships: [] };
      reservation_members: { Row: ReservationMemberRow; Insert: Partial<ReservationMemberRow>; Update: Partial<ReservationMemberRow>; Relationships: [] };
      shuttle_runs: { Row: ShuttleRunRow; Insert: Partial<ShuttleRunRow>; Update: Partial<ShuttleRunRow>; Relationships: [] };
      stations: { Row: StationRow; Insert: Partial<StationRow>; Update: Partial<StationRow>; Relationships: [] };
      checkins: { Row: CheckinRow; Insert: Partial<CheckinRow>; Update: Partial<CheckinRow>; Relationships: [] };
      hospitality_items: { Row: HospitalityItemRow; Insert: Partial<HospitalityItemRow>; Update: Partial<HospitalityItemRow>; Relationships: [] };
      seat_assignments: { Row: SeatAssignmentRow; Insert: Partial<SeatAssignmentRow>; Update: Partial<SeatAssignmentRow>; Relationships: [] };
      seats: { Row: SeatRow; Insert: Partial<SeatRow>; Update: Partial<SeatRow>; Relationships: [] };
      parking_state: { Row: ParkingStateRow; Insert: Partial<ParkingStateRow>; Update: Partial<ParkingStateRow>; Relationships: [] };
      vip_arrivals: { Row: VipArrivalRow; Insert: Partial<VipArrivalRow>; Update: Partial<VipArrivalRow>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      create_reservation: { Args: { payload: Json; token_hash: string }; Returns: { reservation_id: string; code: string; party_size: number } };
      admin_create_reservation: { Args: { payload: Json; token_hash: string }; Returns: { reservation_id: string; code: string; party_size: number } };
      find_duplicates: { Args: { p_rows: Json }; Returns: { name: string; phone: string; code: string }[] };
      seat_map: { Args: Record<string, never>; Returns: SeatMapCell[] };
      reassign_seats: { Args: { p_reservation_id: string; p_seat_ids: string[]; p_manual?: boolean }; Returns: string | null };
      parking_adjust: { Args: { p_delta: number; p_capacity?: number | null }; Returns: { capacity: number; occupied: number; free: number } };
      parking_board: { Args: Record<string, never>; Returns: ParkingBoard };
      vip_mark: { Args: { p_reservation_id: string; p_arrived: boolean }; Returns: null };
      lookup_pass: { Args: { p_token_hash: string }; Returns: PassLookup | null };
      find_reservations: { Args: { p_query: string }; Returns: ReservationSummary[] };
      get_reservation_summary: { Args: { p_reservation_id: string }; Returns: ReservationSummary | null };
      lookup_reservation_by_pass: { Args: { p_token_hash: string }; Returns: ReservationSummary | null };
      perform_checkin: { Args: { p_reservation_id: string; p_station_code: string; p_arrived_count: number; p_method: string; p_distributions: Json; p_seat_ids?: string[] | null; p_manual?: boolean }; Returns: CheckinResult };
      ops_stats: { Args: Record<string, never>; Returns: OpsStats };
      my_roles: { Args: Record<string, never>; Returns: string[] };
    };
    Enums: { staff_role: "staff" | "desk" | "admin" };
    CompositeTypes: Record<string, never>;
  };
};
