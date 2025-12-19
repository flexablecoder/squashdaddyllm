
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type BookingDocument = HydratedDocument<Booking>;

@Schema()
export class BookingHistory {
    @Prop({ default: Date.now })
    changed_at: Date;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
    changed_by: Types.ObjectId;

    @Prop()
    action: string;

    @Prop()
    reason: string;
}

const BookingHistorySchema = SchemaFactory.createForClass(BookingHistory);

@Schema()
export class Booking {
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
    coach_id: Types.ObjectId;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
    player_id: Types.ObjectId;

    @Prop({ required: true })
    booking_date: Date;

    @Prop({ required: true })
    start_time: string;

    @Prop({ required: true })
    end_time: string;

    @Prop({ required: true, enum: ['lesson', 'unavailable', 'travel', 'tournament', 'other'] })
    booking_type: string;

    @Prop({ default: 'scheduled' })
    status: string;

    @Prop({ default: 'unpaid' })
    payment_status: string;

    @Prop({ type: [BookingHistorySchema], default: [] })
    history: BookingHistory[];
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
