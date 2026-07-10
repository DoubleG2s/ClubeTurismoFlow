import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

export interface BrasilCity {
  nome: string;
  estado: string;
  id: number;
}

export interface BrasilCep {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
}

@Injectable({ providedIn: 'root' })
export class BrasilApiService {
  private readonly BASE_URL = 'https://brasilapi.com.br/api';
  private cityCache = new Map<string, BrasilCity[]>();
  private cepCache = new Map<string, BrasilCep | null>();

  searchCities(term: string): Observable<BrasilCity[]> {
    const key = term.trim().toLowerCase();
    if (key.length < 2) return of([]);

    const cached = this.cityCache.get(key);
    if (cached) return of(cached);

    return from(this.fetchCities(term)).pipe(
      tap(cities => {
        if (cities.length > 0) {
          this.cityCache.set(key, cities);
        }
      }),
      catchError(() => of([]))
    );
  }

  private async fetchCities(term: string): Promise<BrasilCity[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(
        `${this.BASE_URL}/cptec/v1/cidade/${encodeURIComponent(term.trim())}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch {
      clearTimeout(timeoutId);
      return [];
    }
  }

  searchCep(cep: string): Observable<BrasilCep | null> {
    const key = cep.replace(/\D/g, '');
    if (key.length !== 8) return of(null);

    const cached = this.cepCache.get(key);
    if (cached !== undefined) return of(cached);

    return from(this.fetchCep(key)).pipe(
      tap(result => this.cepCache.set(key, result)),
      catchError(() => of(null))
    );
  }

  private async fetchCep(cep: string): Promise<BrasilCep | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${this.BASE_URL}/cep/v2/${cep}`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) return null;
      const data = await response.json();
      return {
        cep: data.cep,
        state: data.state,
        city: data.city,
        neighborhood: data.neighborhood,
        street: data.street
      };
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  }
}
