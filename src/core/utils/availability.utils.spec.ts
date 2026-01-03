/**
 * Integration Tests for Availability Calculation Utilities
 */

import {
    getDayOfWeek,
    generateHourlySlots,
    isSlotBooked,
    getDateRange,
    calculateAvailableSlots,
    getAvailableSlotsOnly,
    CoachSchedule,
    Booking,
} from './availability.utils';

describe('Availability Utils', () => {
    // Sample coach schedule by API Standard (0=Mon...6=Sun)
    // Friday=4 (15:00-19:00), Saturday=5 (08:00-13:00 & 14:00-17:00), Tuesday=1 (15:00-21:00)
    const sampleSchedule: CoachSchedule[] = [
        { id: '1', day_of_week: 4, start_time: '15:00', end_time: '19:00', is_available: true }, // Friday
        { id: '2', day_of_week: 5, start_time: '08:00', end_time: '13:00', is_available: true }, // Saturday AM
        { id: '3', day_of_week: 5, start_time: '14:00', end_time: '17:00', is_available: true }, // Saturday PM
        { id: '4', day_of_week: 1, start_time: '15:00', end_time: '21:00', is_available: true }, // Tuesday
    ];

    describe('getDayOfWeek', () => {
        it('should return 4 for Friday 2025-01-03', () => {
            expect(getDayOfWeek('2025-01-03')).toBe(4);
        });

        it('should return 5 for Saturday 2025-01-04', () => {
            expect(getDayOfWeek('2025-01-04')).toBe(5);
        });

        it('should return 6 for Sunday 2025-01-05', () => {
            expect(getDayOfWeek('2025-01-05')).toBe(6);
        });
    });

    describe('generateHourlySlots', () => {
        it('should generate hourly slots from 15:00 to 19:00', () => {
            const slots = generateHourlySlots('15:00', '19:00');
            expect(slots).toEqual(['15:00', '16:00', '17:00', '18:00']);
        });

        it('should generate morning slots from 08:00 to 13:00', () => {
            const slots = generateHourlySlots('08:00', '13:00');
            expect(slots).toEqual(['08:00', '09:00', '10:00', '11:00', '12:00']);
        });
    });

    describe('isSlotBooked', () => {
        const bookings: Booking[] = [
            { id: 'b1', booking_date: '2025-01-03T00:00:00', start_time: '15:00', end_time: '16:00', status: 'scheduled' },
            { id: 'b2', booking_date: '2025-01-03T00:00:00', start_time: '17:00', end_time: '18:00', status: 'scheduled' },
            { id: 'b3', booking_date: '2025-01-03T00:00:00', start_time: '18:00', end_time: '19:00', status: 'cancelled' },
        ];

        it('should return true for booked slot 15:00', () => {
            expect(isSlotBooked('15:00', '2025-01-03', bookings)).toBe(true);
        });

        it('should return false for unbooked slot 16:00', () => {
            expect(isSlotBooked('16:00', '2025-01-03', bookings)).toBe(false);
        });

        it('should return false for cancelled booking at 18:00', () => {
            expect(isSlotBooked('18:00', '2025-01-03', bookings)).toBe(false);
        });

        it('should return false for different date', () => {
            expect(isSlotBooked('15:00', '2025-01-04', bookings)).toBe(false);
        });
    });

    describe('getDateRange', () => {
        it('should generate correct date range', () => {
            const dates = getDateRange('2025-01-03', '2025-01-05');
            expect(dates).toEqual(['2025-01-03', '2025-01-04', '2025-01-05']);
        });

        it('should throw error for range > 31 days', () => {
            expect(() => getDateRange('2025-01-01', '2025-03-01')).toThrow('Date range cannot exceed 31 days');
        });
    });

    // Test Case 1: Friday with no bookings
    describe('calculateAvailableSlots - Single Day', () => {
        it('Test 1: Friday with no bookings, available 15-19', () => {
            const slots = calculateAvailableSlots(sampleSchedule, [], '2025-01-03');
            const available = getAvailableSlotsOnly(slots);
            
            expect(available.length).toBe(4);
            expect(available.map(s => s.start_time)).toEqual(['15:00', '16:00', '17:00', '18:00']);
        });

        // Test Case 2: Friday with one booking at 15:00
        it('Test 2: Friday with booking at 15:00', () => {
            const bookings: Booking[] = [
                { id: 'b1', booking_date: '2025-01-03T00:00:00', start_time: '15:00', end_time: '16:00', status: 'scheduled' },
            ];
            const slots = calculateAvailableSlots(sampleSchedule, bookings, '2025-01-03');
            const available = getAvailableSlotsOnly(slots);
            
            expect(available.length).toBe(3);
            expect(available.map(s => s.start_time)).toEqual(['16:00', '17:00', '18:00']);
        });

        // Test Case 3: Friday with multiple bookings (15:00 and 17:00)
        it('Test 3: Friday with multiple bookings', () => {
            const bookings: Booking[] = [
                { id: 'b1', booking_date: '2025-01-03T00:00:00', start_time: '15:00', end_time: '16:00', status: 'scheduled' },
                { id: 'b2', booking_date: '2025-01-03T00:00:00', start_time: '17:00', end_time: '18:00', status: 'scheduled' },
            ];
            const slots = calculateAvailableSlots(sampleSchedule, bookings, '2025-01-03');
            const available = getAvailableSlotsOnly(slots);
            
            expect(available.length).toBe(2);
            expect(available.map(s => s.start_time)).toEqual(['16:00', '18:00']);
        });

        // Test Case 4: Sunday with no availability defined
        it('Test 4: Sunday with no availability', () => {
            const slots = calculateAvailableSlots(sampleSchedule, [], '2025-01-05');
            expect(slots.length).toBe(0);
        });

        // Test Case 5: Saturday with split availability (08-13 and 14-17)
        it('Test 5: Saturday with split availability', () => {
            const slots = calculateAvailableSlots(sampleSchedule, [], '2025-01-04');
            const available = getAvailableSlotsOnly(slots);
            
            // AM: 08,09,10,11,12 (5 slots) + PM: 14,15,16 (3 slots) = 8 total
            expect(available.length).toBe(8);
            expect(available.map(s => s.start_time)).toContain('08:00');
            expect(available.map(s => s.start_time)).toContain('12:00');
            expect(available.map(s => s.start_time)).toContain('14:00');
            expect(available.map(s => s.start_time)).toContain('16:00');
        });

        // Test Case 6: Fully booked day
        it('Test 6: Fully booked Friday', () => {
            const bookings: Booking[] = [
                { id: 'b1', booking_date: '2025-01-03T00:00:00', start_time: '15:00', end_time: '16:00', status: 'scheduled' },
                { id: 'b2', booking_date: '2025-01-03T00:00:00', start_time: '16:00', end_time: '17:00', status: 'scheduled' },
                { id: 'b3', booking_date: '2025-01-03T00:00:00', start_time: '17:00', end_time: '18:00', status: 'scheduled' },
                { id: 'b4', booking_date: '2025-01-03T00:00:00', start_time: '18:00', end_time: '19:00', status: 'scheduled' },
            ];
            const slots = calculateAvailableSlots(sampleSchedule, bookings, '2025-01-03');
            const available = getAvailableSlotsOnly(slots);
            
            expect(available.length).toBe(0);
        });
    });

    // Test Cases for Multi-Day Range
    describe('calculateAvailableSlots - Multi-Day Range', () => {
        // Test Case 8: Week range with mixed availability
        it('Test 8: Week range (Tue-Sat) with no bookings', () => {
            // Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
            // Schedule has: Tue (15-21=6 slots), Fri (15-19=4 slots), Sat (5+3=8 slots)
            const slots = calculateAvailableSlots(sampleSchedule, [], '2025-01-07', '2025-01-11');
            const available = getAvailableSlotsOnly(slots);
            
            // Tue Jan 7: 6 slots, Wed Jan 8: 0, Thu Jan 9: 0, Fri Jan 10: 4, Sat Jan 11: 8
            expect(available.length).toBe(18);
        });

        // Test Case 9: Multi-day with bookings filtering
        it('Test 9: Multi-day with bookings', () => {
            const bookings: Booking[] = [
                { id: 'b1', booking_date: '2025-01-03T00:00:00', start_time: '15:00', end_time: '16:00', status: 'scheduled' },
                { id: 'b2', booking_date: '2025-01-04T00:00:00', start_time: '08:00', end_time: '09:00', status: 'scheduled' },
            ];
            // Fri Jan 3 + Sat Jan 4
            const slots = calculateAvailableSlots(sampleSchedule, bookings, '2025-01-03', '2025-01-04');
            const available = getAvailableSlotsOnly(slots);
            
            // Fri: 4 slots - 1 booked = 3
            // Sat: 8 slots - 1 booked = 7
            expect(available.length).toBe(10);
        });

        // Test Case 10: Max range enforcement (>31 days)
        it('Test 10: Should throw error for range > 31 days', () => {
            expect(() => 
                calculateAvailableSlots(sampleSchedule, [], '2025-01-01', '2025-03-01')
            ).toThrow('Date range cannot exceed 31 days');
        });
    });
});
