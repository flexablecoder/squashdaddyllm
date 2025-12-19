
import { AvailabilitySlot } from '../../common/dtos/availability.dto';

export interface IBookingSystem {
    /**
     * Find availability for a given coach and date range
     */
    findAvailability(coachId: string, date: string): Promise<AvailabilitySlot[]>;

    /**
     * Create a tentative booking (without confirming payment yet)
     */
    createBooking(bookingDetails: any): Promise<any>;

    /**
     * Get players assigned to a coach to verify connectivity
     */
    getAssignedPlayers(coachId: string): Promise<any[]>;
}
