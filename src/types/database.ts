export type OrderStatus = 'queued' | 'grinding' | 'ready' | 'completed';

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
