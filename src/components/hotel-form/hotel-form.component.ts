import { Component, EventEmitter, Input, Output, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Hotel, HotelEmail, HotelPhone, HotelImage, HotelType, HotelEmailType } from '../../models/hotel';
import { HotelService } from '../../services/hotel.service';
import { CityAutocompleteComponent } from '../shared/city-autocomplete/city-autocomplete.component';
import { BrasilCity } from '../../services/brasil-api.service';

@Component({
    selector: 'app-hotel-form',
    standalone: true,
    imports: [CommonModule, FormsModule, CityAutocompleteComponent],
    templateUrl: './hotel-form.component.html'
})
export class HotelFormComponent implements OnInit {
    private hotelService = inject(HotelService);

    @Input() hotelToEdit: Hotel | null = null;
    @Input() isLoading: boolean = false;
    @Input() prefillName?: string = '';

    @Output() save = new EventEmitter<{
        hotelData: any,
        emails: any[],
        phones: any[],
        images: any[],
        newImages: any[],
        deletedEmailIds: string[],
        deletedPhoneIds: string[],
        deletedImageIds: string[]
    }>();

    @Output() cancel = new EventEmitter<void>();

    // Basic Details
    id = signal('');
    name = signal('');
    brand = signal('');
    category = signal<number>(3);
    type = signal<HotelType>('hotel');
    city = signal('');
    state = signal('');
    country = signal('Brasil');
    checkin = signal('14:00');
    checkout = signal('12:00');

    // Arrays
    emails = signal<Array<Partial<HotelEmail> & { _tempId: string }>>([]);
    phones = signal<Array<Partial<HotelPhone> & { _tempId: string }>>([]);
    images = signal<Array<Partial<HotelImage> & { _tempId: string, isUploading?: boolean, file?: File }>>([]);

    // Deletions tracking
    deletedEmailIds = signal<string[]>([]);
    deletedPhoneIds = signal<string[]>([]);
    deletedImageIds = signal<string[]>([]);

    uniqueId = Math.random().toString(36).substring(2, 9);
    toastMessage = signal<{text: string, type: 'success' | 'error'} | null>(null);

    onCitySelected(city: BrasilCity) {
        this.city.set(city.nome);
        this.state.set(city.estado);
        this.country.set('Brasil');
    }

    ngOnInit() {
        if (this.prefillName && !this.hotelToEdit) {
            this.name.set(this.prefillName);
        }

        if (this.hotelToEdit) {
            this.id.set(this.hotelToEdit.id);
            this.name.set(this.hotelToEdit.name);
            this.brand.set(this.hotelToEdit.brand || '');
            this.category.set(this.hotelToEdit.category || 3);
            this.type.set(this.hotelToEdit.type || 'hotel');
            this.city.set(this.hotelToEdit.location_city || '');
            this.state.set(this.hotelToEdit.location_state || '');
            this.country.set(this.hotelToEdit.location_country || '');
            this.checkin.set(this.hotelToEdit.default_checkin || '');
            this.checkout.set(this.hotelToEdit.default_checkout || '');

            if (this.hotelToEdit.hotel_emails) {
                this.emails.set(this.hotelToEdit.hotel_emails.map(e => ({ ...e, _tempId: Math.random().toString() })));
            }
            if (this.hotelToEdit.hotel_phones) {
                this.phones.set(this.hotelToEdit.hotel_phones.map(p => ({ ...p, _tempId: Math.random().toString() })));
            }
            if (this.hotelToEdit.hotel_images) {
                this.images.set(this.hotelToEdit.hotel_images.map(i => ({ ...i, _tempId: Math.random().toString() })));
            }
        }
    }

    // Generic List operations
    addEmail() {
        this.emails.update(current => [...current, { _tempId: Math.random().toString(), email: '', type: 'reservas' }]);
    }

    removeEmail(tempId: string) {
        const item = this.emails().find(e => e._tempId === tempId);
        if (item && item.id) this.deletedEmailIds.update(ids => [...ids, item.id!]);
        this.emails.update(current => current.filter(e => e._tempId !== tempId));
    }

    addPhone() {
        this.phones.update(current => [...current, { _tempId: Math.random().toString(), phone: '', is_whatsapp: false }]);
    }

    removePhone(tempId: string) {
        const item = this.phones().find(p => p._tempId === tempId);
        if (item && item.id) this.deletedPhoneIds.update(ids => [...ids, item.id!]);
        this.phones.update(current => current.filter(p => p._tempId !== tempId));
    }

    // Image Upload Logic
    async onFileSelected(event: any) {
        if (this.images().length >= 3) {
            // Not allowed to add more than 3
            return;
        }

        const file: File = event.target.files[0];
        if (file) {
            const tempId = Math.random().toString();

            // Add a placeholder to UI
            this.images.update(current => [...current, {
                _tempId: tempId,
                image_url: '',
                description: '',
                isUploading: true,
                file: file
            }]);

            // Upload it
            const url = await this.hotelService.uploadImage(file);

            if (url) {
                this.images.update(current => current.map(img => {
                    if (img._tempId === tempId) {
                        return { ...img, image_url: url, isUploading: false, file: undefined };
                    }
                    return img;
                }));
                this.showToast('Imagem adicionada com sucesso!', 'success');
            } else {
                // Handle error (just remove placeholder)
                this.images.update(current => current.filter(i => i._tempId !== tempId));
                this.showToast('Erro ao enviar imagem', 'error');
            }
        }
    }

    removeImage(tempId: string) {
        const item = this.images().find(i => i._tempId === tempId);
        if (item && item.id) this.deletedImageIds.update(ids => [...ids, item.id!]);
        this.images.update(current => current.filter(i => i._tempId !== tempId));
        this.showToast('Imagem removida com sucesso!', 'success');
    }

    showToast(text: string, type: 'success' | 'error' = 'success') {
        this.toastMessage.set({ text, type });
        setTimeout(() => {
            this.toastMessage.set(null);
        }, 3000);
    }

    onSubmit() {
        if (!this.name()) return;

        // Filter out items without values
        const finalEmails = this.emails().filter(e => !!e.email);
        const finalPhones = this.phones().filter(p => !!p.phone);
        const finalImages = this.images().filter(i => !!i.image_url && !i.isUploading);

        const baseData = {
            name: this.name(),
            brand: this.brand(),
            category: this.category(),
            type: this.type(),
            location_city: this.city(),
            location_state: this.state(),
            location_country: this.country(),
            default_checkin: this.checkin(),
            default_checkout: this.checkout()
        };

        // New items do not have an ID yet
        const newEmails = finalEmails.filter(e => !e.id).map(e => ({ email: e.email!, type: e.type! }));
        const newPhones = finalPhones.filter(p => !p.id).map(p => ({ phone: p.phone!, is_whatsapp: p.is_whatsapp! }));
        const newImages = finalImages.filter(i => !i.id).map(i => ({ image_url: i.image_url!, description: i.description }));

        this.save.emit({
            hotelData: baseData,
            emails: this.hotelToEdit ? finalEmails : newEmails,
            phones: this.hotelToEdit ? finalPhones : newPhones,
            images: this.hotelToEdit ? finalImages : newImages,
            newImages: newImages,
            deletedEmailIds: this.deletedEmailIds(),
            deletedPhoneIds: this.deletedPhoneIds(),
            deletedImageIds: this.deletedImageIds()
        });

        if (!this.hotelToEdit) {
            this.resetForm();
        }
    }

    resetForm() {
        this.id.set('');
        this.name.set('');
        this.brand.set('');
        this.category.set(3);
        this.type.set('hotel');
        this.city.set('');
        this.state.set('');
        this.country.set('Brasil');
        this.checkin.set('14:00');
        this.checkout.set('12:00');
        this.emails.set([]);
        this.phones.set([]);
        this.images.set([]);
        this.deletedEmailIds.set([]);
        this.deletedPhoneIds.set([]);
        this.deletedImageIds.set([]);
    }
}
