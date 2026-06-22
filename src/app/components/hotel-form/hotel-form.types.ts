import { HotelEmailType, HotelType } from '@models/hotel';

export interface HotelFormDataPayload {
  name: string;
  brand: string;
  category: number;
  type: HotelType;
  location_city: string;
  location_state: string;
  location_country: string;
  default_checkin: string;
  default_checkout: string;
  description?: string;
}

export interface HotelFormEmailPayload {
  id?: string;
  email: string;
  type: HotelEmailType;
}

export interface HotelFormPhonePayload {
  id?: string;
  phone: string;
  is_whatsapp: boolean;
}

export interface HotelFormImagePayload {
  id?: string;
  image_url: string;
  description?: string;
}

export interface HotelFormSubmission {
  hotelData: HotelFormDataPayload;
  emails: HotelFormEmailPayload[];
  phones: HotelFormPhonePayload[];
  images: HotelFormImagePayload[];
  newImages: HotelFormImagePayload[];
  deletedEmailIds: string[];
  deletedPhoneIds: string[];
  deletedImageIds: string[];
}
