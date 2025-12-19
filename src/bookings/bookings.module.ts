
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema } from './schemas/booking.schema';
import { AvailabilitySlot, AvailabilitySlotSchema } from './schemas/availability.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Booking.name, schema: BookingSchema },
            { name: AvailabilitySlot.name, schema: AvailabilitySlotSchema },
        ]),
    ],
})
export class BookingsModule { }
