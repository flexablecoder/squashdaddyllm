
import { Injectable, Logger } from '@nestjs/common';
import { PythonApiAdapter } from '../core/adapters/python-api.adapter';
import { GmailService } from '../connectors/gmail/gmail.service';
import { GeminiService } from './gemini.service';
import { AvailabilitySlot } from '../common/dtos/availability.dto';

@Injectable()
export class AgentOrchestrator {
    private readonly logger = new Logger(AgentOrchestrator.name);

    constructor(
        private readonly pythonAdapter: PythonApiAdapter,
        private readonly gmailService: GmailService,
        private readonly geminiService: GeminiService
    ) { }

    async processEmailIntent(coachId: string, emailContent: string, sender: string, subject: string, refreshToken: string) {
        this.logger.log(`Processing intent for Coach ${coachId} from ${sender}`);

        // 1. Analyze with Gemini
        const analysis = await this.geminiService.analyzeEmail(subject, emailContent, sender);

        if (analysis.intent === 'OTHER') {
            this.logger.log(`Skipping email from ${sender} - Intent: OTHER`);
            return;
        }

        this.logger.log(`Detected Intent: ${analysis.intent} with confidence ${analysis.confidence}`);

        try {
            // 2. CHECK_SCHEDULE Logic
            if (analysis.intent === 'CHECK_SCHEDULE' || analysis.intent === 'MULTI_INTENT') {
                const schedule = await this.pythonAdapter.getPlayerSchedule(sender);
                const scheduleText = schedule.length > 0
                    ? schedule.map((s: any) => `- ${s.date} at ${s.time} with Coach ${s.coach}`).join('\n')
                    : 'You have no upcoming sessions scheduled.';

                await this.gmailService.sendReply(refreshToken, 'thread-id-placeholder', `Here is your schedule:\n${scheduleText}`);
            }

            // 3. BOOK_LESSON Logic
            if (analysis.intent === 'BOOK_LESSON' || analysis.intent === 'MULTI_INTENT') {
                for (const req of analysis.requests) {
                    if (req.intent === 'BOOK_LESSON' && req.date && req.time) {
                        this.logger.log(`Attempting booking for ${req.date} @ ${req.time}`);

                        // Check availability
                        const slots = await this.pythonAdapter.findAvailability(coachId, req.date);
                        // Simple fuzzy match for MVP (e.g., "10:00" in "10:00:00")
                        const targetSlot = slots.find(s => s.start_time.startsWith(req.time) && s.is_available);

                        if (targetSlot) {
                            await this.pythonAdapter.createBooking({
                                coach_id: coachId,
                                player_id: "determined-from-sender-email", // TODO: Real lookup
                                booking_date: req.date,
                                start_time: req.time,
                                end_time: "calculated-end",
                                status: "confirmed"
                            });
                            await this.gmailService.sendReply(refreshToken, 'thread-id-placeholder', `Confirmed booking for ${req.date} at ${req.time}.`);
                        } else {
                            // Suggest alternatives (Mock logic: find next 2 available)
                            const alternatives = slots.filter(s => s.is_available).slice(0, 2);
                            const altText = alternatives.map(s => s.start_time).join(' or ');
                            const message = `Sorry, ${req.time} is not available on ${req.date}.` + (altText ? ` Try: ${altText}` : '');

                            await this.gmailService.sendReply(refreshToken, 'thread-id-placeholder', message);
                        }
                    }
                }
            }
        } catch (error) {
            this.logger.error('Error executing agent actions', error);
        }
    }

    private filterSlotsByLocation(slots: AvailabilitySlot[], requiredLocationId: string): AvailabilitySlot[] {
        return slots;
    }
}
