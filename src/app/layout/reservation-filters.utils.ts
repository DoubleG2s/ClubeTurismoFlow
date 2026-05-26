import { Reservation } from '@models/reservation';
import {
  MONTH_NAMES,
  QuickFilter,
  ReservationActiveFilters,
  ReservationDraftFilters
} from '@layout/app-shell.types';
import {
  getPtBrDateMonthYear,
  getStartOfDayTimestamp,
  parsePtBrDate
} from '@shared/utils/date.utils';

type ReservationFilteringContext = ReservationActiveFilters & {
  month: number;
  year: number;
  now?: Date;
};

export function buildMonthLabel(month: number, year: number): string {
  return `${MONTH_NAMES[month] ?? ''} ${year}`.trim();
}

export function filterReservations(
  reservations: Reservation[],
  filters: ReservationFilteringContext
): Reservation[] {
  const {
    month,
    year,
    searchTerm,
    quickFilter,
    dateStart,
    dateEnd,
    returnStart,
    returnEnd,
    missingHotelEmail,
    missingPostTrip,
    sortField,
    sortDirection,
    now = new Date()
  } = filters;

  let result = filterReservationsByMonth(reservations, month, year, quickFilter);

  if (searchTerm.trim()) {
    const normalizedTerm = searchTerm.toLowerCase().trim();
    result = result.filter((reservation) =>
      reservation.passengers.some((passenger) => passenger.toLowerCase().includes(normalizedTerm)) ||
      reservation.reservation_number.toLowerCase().includes(normalizedTerm) ||
      (reservation.flight_voucher && reservation.flight_voucher.toLowerCase().includes(normalizedTerm))
    );
  }

  if (quickFilter) {
    const todayTime = getStartOfDayTimestamp(now);
    const tomorrowTime = getStartOfDayTimestamp(new Date(todayTime + 1000 * 60 * 60 * 24));

    result = result.filter((reservation) => {
      const departureDate = parsePtBrDate(reservation.date);
      const returnDate = parsePtBrDate(reservation.return_date);

      if (quickFilter === 'hoje') {
        return departureDate === todayTime;
      }

      if (quickFilter === 'amanha') {
        return departureDate === tomorrowTime;
      }

      return returnDate > 0 && todayTime >= departureDate && todayTime <= returnDate;
    });
  }

  const departureStart = parsePtBrDate(dateStart);
  const departureEnd = parsePtBrDate(dateEnd);
  const returnStartTime = parsePtBrDate(returnStart);
  const returnEndTime = parsePtBrDate(returnEnd);

  if (departureStart || departureEnd || returnStartTime || returnEndTime) {
    result = result.filter((reservation) => {
      const departureDate = parsePtBrDate(reservation.date);
      const reservationReturnDate = parsePtBrDate(reservation.return_date);

      const matchesDeparture =
        (!departureStart || departureDate >= departureStart) &&
        (!departureEnd || departureDate <= departureEnd);

      const hasReturnFilter = returnStartTime || returnEndTime;
      let matchesReturn = true;

      if (hasReturnFilter) {
        matchesReturn =
          reservationReturnDate > 0 &&
          (!returnStartTime || reservationReturnDate >= returnStartTime) &&
          (!returnEndTime || reservationReturnDate <= returnEndTime);
      }

      return matchesDeparture && matchesReturn;
    });
  }

  if (missingHotelEmail || missingPostTrip) {
    const todayTime = getStartOfDayTimestamp(now);

    result = result.filter((reservation) => {
      const matchesHotel = !missingHotelEmail || !reservation.checklist?.hotel_email;
      const reservationReturnDate = parsePtBrDate(reservation.return_date);
      const matchesPostTrip =
        !missingPostTrip ||
        (reservationReturnDate > 0 && reservationReturnDate < todayTime && !reservation.checklist?.post_trip);

      return matchesHotel && matchesPostTrip;
    });
  }

  const direction = sortDirection === 'asc' ? 1 : -1;

  return [...result].sort((first, second) => {
    const firstDate = sortField === 'date' ? parsePtBrDate(first.date) : parsePtBrDate(first.return_date);
    const secondDate = sortField === 'date' ? parsePtBrDate(second.date) : parsePtBrDate(second.return_date);

    return (firstDate - secondDate) * direction;
  });
}

export function hasActiveReservationFilters(filters: ReservationActiveFilters): boolean {
  return Boolean(
    filters.searchTerm ||
    filters.dateStart ||
    filters.dateEnd ||
    filters.returnStart ||
    filters.returnEnd ||
    filters.quickFilter !== null ||
    filters.missingHotelEmail ||
    filters.missingPostTrip
  );
}

export function hasDraftReservationFilters(filters: ReservationDraftFilters): boolean {
  return Boolean(
    filters.dateStart ||
    filters.dateEnd ||
    filters.returnStart ||
    filters.returnEnd ||
    filters.missingHotelEmail ||
    filters.missingPostTrip
  );
}

function filterReservationsByMonth(
  reservations: Reservation[],
  month: number,
  year: number,
  quickFilter: QuickFilter
): Reservation[] {
  return reservations.filter((reservation) => {
    if (quickFilter === 'em_viagem') {
      return true;
    }

    const monthYear = getPtBrDateMonthYear(reservation.date);
    if (!monthYear) {
      return false;
    }

    return monthYear.month === month && monthYear.year === year;
  });
}
