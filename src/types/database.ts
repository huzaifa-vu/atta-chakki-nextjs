export type OrderStatus = 'queued' | 'grinding' | 'ready' | 'completed';

export interface DayBreak {
  id?: string;
  start: string; // '13:00' (24-hr format)
  end: string;   // '14:30' (24-hr format)
  label?: string; // e.g. 'Jummah Prayer' or 'Lunch Break'
  enabled?: boolean; // legacy compatibility
}

export interface DaySchedule {
  isOpen: boolean;
  open: string;  // '08:00'
  close: string; // '21:00'
  break?: DayBreak; // legacy single break support
  breaks?: DayBreak[]; // multiple breaks per day support
}

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type WeeklySchedule = Record<DayOfWeek, DaySchedule>;

export interface ShopSettings {
  id: string;
  shop_name: string;
  phone_number: string;
  rate_per_kg: number;
  currency: string;
  opening_time?: string;
  closing_time?: string;
  is_closed_override?: boolean;
  closed_reason?: string;
  weekly_schedule?: WeeklySchedule | null;
  updated_at: string;
}

export interface Order {
  id: string;
  token_number: number;
  customer_name: string | null;
  weight_kg: number;
  rate_per_kg: number;
  total_price: number;
  status: OrderStatus;
  access_code: string | null;
  is_paid: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}
