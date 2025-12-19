
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CoachConfigDocument = HydratedDocument<CoachConfig>;

@Schema({ collection: 'coach_configs' })
export class CoachConfig {
    @Prop({ required: true, index: true })
    coach_id: string; // References Python Backend ID string

    @Prop({ required: true })
    gmail_access_token: string;

    @Prop({ required: true })
    gmail_refresh_token: string;

    @Prop({ required: true })
    email_address: string;

    @Prop({ type: Object })
    location_preferences: any; // Flexible JSON for location rules
}

export const CoachConfigSchema = SchemaFactory.createForClass(CoachConfig);
