
export class AvailabilitySlot {
    start_time: string;
    end_time: string;
    location_id: string; // e.g., 'morning_court', 'afternoon_court'
    is_booked: boolean;
    is_available: boolean;
}
