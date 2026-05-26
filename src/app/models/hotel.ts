export type HotelType = 'resort' | 'hotel' | 'pousada';
export type HotelEmailType = 'reservas' | 'financeiro' | 'executivo';

export interface Hotel {
  id: string;
  name: string;
  brand?: string;
  category?: number; // 1 to 5 stars
  type?: HotelType;
  location_city?: string;
  location_state?: string;
  location_country?: string;
  default_checkin?: string;
  default_checkout?: string;
  created_at?: string;
  updated_at?: string;

  // Relations mapped from Supabase foreign keys
  hotel_emails?: HotelEmail[];
  hotel_phones?: HotelPhone[];
  hotel_images?: HotelImage[];
}

export interface HotelEmail {
  id: string;
  hotel_id: string;
  type: HotelEmailType;
  email: string;
  created_at?: string;
}

export interface HotelPhone {
  id: string;
  hotel_id: string;
  phone: string;
  is_whatsapp: boolean;
  created_at?: string;
}

export interface HotelImage {
  id: string;
  hotel_id: string;
  image_url: string;
  description?: string;
  created_at?: string;
}
