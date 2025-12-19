
import { AvailabilitySlot } from './availability.dto';

export class CoachProfile {
    id: string;
    default_location_id: string;
    time_zone: string;
    working_hours: AvailabilitySlot[];
}
