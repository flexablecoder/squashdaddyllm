
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AvailabilitySlotDocument = HydratedDocument<AvailabilitySlot>;

@Schema()
export class AvailabilitySlot {
    @Prop({ required: true })
    day_of_week: number;

    @Prop({ required: true })
    start_time: string;

    @Prop({ required: true })
    end_time: string;

    @Prop({ required: true })
    is_available: boolean;
}

export const AvailabilitySlotSchema = SchemaFactory.createForClass(AvailabilitySlot);
