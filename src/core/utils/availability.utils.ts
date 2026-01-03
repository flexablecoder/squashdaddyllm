/**
 * Availability Calculation Utilities
 * Combines coach schedule with bookings to determine available slots
 */

export interface CoachSchedule {
    id: string;
    day_of_week: number; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    start_time: string;  // "15:00"
    end_time: string;    // "19:00"
    is_available: boolean;
}

export interface Booking {
    id: string;
    booking_date: string; // "2025-01-03T00:00:00"
    start_time: string;   // "15:00"
    end_time: string;     // "16:00"
    status: string;
}

export interface AvailabilitySlot {
    date: string;         // "2025-01-03"
    start_time: string;   // "15:00"
    is_available: boolean;
}

/**
 * Get day of week from date string (Compatible with Python API: 0=Monday, 6=Sunday)
 * JS getUTCDay() returns 0=Sunday...6=Saturday
 * Conversion: (jsDay + 6) % 7
 */
export function getDayOfWeek(dateString: string): number {
    const date = new Date(dateString);
    const jsDay = date.getUTCDay();
    return (jsDay + 6) % 7;
}

/**
 * Generate hourly time slots between start and end times
 * @param startTime "15:00"
 * @param endTime "19:00"
 * @returns ["15:00", "16:00", "17:00", "18:00"]
 */
export function generateHourlySlots(startTime: string, endTime: string): string[] {
    const slots: string[] = [];
    const [startHour] = startTime.split(':').map(Number);
    const [endHour] = endTime.split(':').map(Number);
    
    for (let hour = startHour; hour < endHour; hour++) {
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    
    return slots;
}

/**
 * Check if a slot overlaps with any booking
 */
export function isSlotBooked(slot: string, date: string, bookings: Booking[]): boolean {
    const slotDate = date.split('T')[0]; // Normalize to YYYY-MM-DD
    
    return bookings.some(booking => {
        const bookingDate = booking.booking_date.split('T')[0];
        if (bookingDate !== slotDate) return false;
        if (booking.status === 'cancelled') return false;
        
        // Check if slot overlaps with booking
        return slot >= booking.start_time && slot < booking.end_time;
    });
}

/**
 * Get dates array between start and end date
 */
export function getDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Enforce max 31 days
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 31) {
        throw new Error('Date range cannot exceed 31 days');
    }
    
    const current = new Date(start);
    while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }
    
    return dates;
}

/**
 * Main function: Calculate available slots for date range
 */
export function calculateAvailableSlots(
    schedules: CoachSchedule[],
    bookings: Booking[],
    startDate: string,
    endDate?: string
): AvailabilitySlot[] {
    const dates = endDate ? getDateRange(startDate, endDate) : [startDate];
    const availableSlots: AvailabilitySlot[] = [];
    
    for (const date of dates) {
        const dayOfWeek = getDayOfWeek(date);
        console.log(`[DEBUG] Date: ${date}, JS Day (0-Sun, 6-Sat): ${new Date(date).getUTCDay()}, Calculated API Day (0-Mon): ${dayOfWeek}`);
        
        // Find schedule windows for this day of week
        const daySchedules = schedules.filter(
            s => s.day_of_week === dayOfWeek && s.is_available
        );
        console.log(`[DEBUG] Found ${daySchedules.length} schedules for day ${dayOfWeek}`);
        if (daySchedules.length > 0) {
             console.log(`[DEBUG] Schedule: ${JSON.stringify(daySchedules[0])}`);
        }
        
        for (const schedule of daySchedules) {
            const slots = generateHourlySlots(schedule.start_time, schedule.end_time);
            
            for (const slot of slots) {
                const isBooked = isSlotBooked(slot, date, bookings);
                availableSlots.push({
                    date,
                    start_time: slot,
                    is_available: !isBooked
                });
            }
        }
    }
    
    return availableSlots;
}

/**
 * Filter to only available slots
 */
export function getAvailableSlotsOnly(slots: AvailabilitySlot[]): AvailabilitySlot[] {
    return slots.filter(s => s.is_available);
}
