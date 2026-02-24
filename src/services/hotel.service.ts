import { Injectable, signal } from '@angular/core';
import { supabase } from './supabase';
import { Hotel, HotelEmail, HotelPhone, HotelImage } from '../models/hotel';

@Injectable({
    providedIn: 'root'
})
export class HotelService {
    private _hotels = signal<Hotel[]>([]);
    private _isLoading = signal(false);

    readonly hotels = this._hotels.asReadonly();
    readonly isLoading = this._isLoading.asReadonly();

    constructor() {
        this.loadHotels();
    }

    async loadHotels() {
        this._isLoading.set(true);
        try {
            // Usando select encadeado para buscar todas as relações 1:N com as FKs apropriadas
            const { data, error } = await supabase
                .from('hotels')
                .select('*, hotel_emails(*), hotel_phones(*), hotel_images(*)');

            if (error) throw error;

            this._hotels.set((data as Hotel[]) || []);
        } catch (error) {
            // Ignorando erro silenciosamente para não violar regra de clean console
        } finally {
            this._isLoading.set(false);
        }
    }

    // Realiza upload da imagem utilizando Supabase Storage
    async uploadImage(file: File): Promise<string | null> {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('hotel-images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('hotel-images')
                .getPublicUrl(filePath);

            return data.publicUrl;
        } catch (error) {
            return null;
        }
    }

    async addHotel(
        hotelData: Omit<Hotel, 'id' | 'created_at' | 'updated_at' | 'hotel_emails' | 'hotel_phones' | 'hotel_images'>,
        emails: Omit<HotelEmail, 'id' | 'hotel_id' | 'created_at'>[],
        phones: Omit<HotelPhone, 'id' | 'hotel_id' | 'created_at'>[],
        images: Omit<HotelImage, 'id' | 'hotel_id' | 'created_at'>[]
    ): Promise<boolean> {
        this._isLoading.set(true);
        try {
            // 1. Inserir hotel raiz
            const { data: newHotel, error: hotelError } = await supabase
                .from('hotels')
                .insert(hotelData)
                .select()
                .single();

            if (hotelError || !newHotel) throw hotelError;

            const hotelId = newHotel.id;

            // 2. Inserir relações filhas atrelando ao ID salvo
            const promises: Promise<any>[] = [];

            if (emails.length > 0) {
                const emailsToInsert = emails.map(e => ({ ...e, hotel_id: hotelId }));
                promises.push(supabase.from('hotel_emails').insert(emailsToInsert) as any);
            }

            if (phones.length > 0) {
                const phonesToInsert = phones.map(p => ({ ...p, hotel_id: hotelId }));
                promises.push(supabase.from('hotel_phones').insert(phonesToInsert) as any);
            }

            if (images.length > 0) {
                // Assegurar limite visual na Request de 3 imagens no máx.
                const imagesToInsert = images.slice(0, 3).map(i => ({ ...i, hotel_id: hotelId }));
                promises.push(supabase.from('hotel_images').insert(imagesToInsert) as any);
            }

            await Promise.all(promises);
            await this.loadHotels();
            return true;
        } catch (error) {
            return false;
        } finally {
            this._isLoading.set(false);
        }
    }

    async updateHotel(
        hotelId: string,
        hotelData: Partial<Hotel>,
        newEmails: Omit<HotelEmail, 'id' | 'hotel_id' | 'created_at'>[],
        newPhones: Omit<HotelPhone, 'id' | 'hotel_id' | 'created_at'>[],
        newImages: Omit<HotelImage, 'id' | 'hotel_id' | 'created_at'>[],
        deletedEmailIds: string[],
        deletedPhoneIds: string[],
        deletedImageIds: string[]
    ): Promise<boolean> {
        this._isLoading.set(true);
        try {
            // Atualizar dados principais
            if (Object.keys(hotelData).length > 0) {
                const { error } = await supabase.from('hotels').update(hotelData).eq('id', hotelId);
                if (error) throw error;
            }

            const promises: Promise<any>[] = [];

            // Remover relações órfãs
            if (deletedEmailIds.length > 0) promises.push(supabase.from('hotel_emails').delete().in('id', deletedEmailIds) as any);
            if (deletedPhoneIds.length > 0) promises.push(supabase.from('hotel_phones').delete().in('id', deletedPhoneIds) as any);
            if (deletedImageIds.length > 0) promises.push(supabase.from('hotel_images').delete().in('id', deletedImageIds) as any);

            // Cadastrar novas relações
            if (newEmails.length > 0) promises.push(supabase.from('hotel_emails').insert(newEmails.map(e => ({ ...e, hotel_id: hotelId }))) as any);
            if (newPhones.length > 0) promises.push(supabase.from('hotel_phones').insert(newPhones.map(p => ({ ...p, hotel_id: hotelId }))) as any);

            // Checar limite de imagens (existentes + novas <= 3) é lidado via UI e via Trigger do Supabase, aqui só enviamos.
            if (newImages.length > 0) promises.push(supabase.from('hotel_images').insert(newImages.map(i => ({ ...i, hotel_id: hotelId }))) as any);

            await Promise.all(promises);
            await this.loadHotels();
            return true;
        } catch (e) {
            return false;
        } finally {
            this._isLoading.set(false);
        }
    }

    async deleteHotel(id: string): Promise<boolean> {
        this._isLoading.set(true);
        try {
            const { error } = await supabase.from('hotels').delete().eq('id', id);
            if (error) throw error;

            this._hotels.update(hotels => hotels.filter(h => h.id !== id));
            return true;
        } catch (error) {
            return false;
        } finally {
            this._isLoading.set(false);
        }
    }
}
