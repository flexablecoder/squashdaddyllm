
export class AvailabilitySlot {
    date?: string;          // "2025-01-03"
    start_time: string;     // "15:00"
    end_time?: string;      // "16:00" (optional - can be calculated)
    location_id?: string;   // e.g., 'morning_court', 'afternoon_court' (optional)
    is_booked?: boolean;    // (optional - derived)
    is_available: boolean;
}
