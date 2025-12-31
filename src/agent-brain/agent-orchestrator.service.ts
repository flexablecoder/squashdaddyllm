
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

    async processEmailIntent(
        coachId: string,
        emailContent: string,
        sender: string,
        subject: string,
        refreshToken: string,
        threadId: string,
        emailHandlingMode: 'draft_only' | 'send_full_replies',
        adminOverride: { enabled: boolean; email: string } | null,
        clientId?: string,
        clientSecret?: string
    ) {
        this.logger.log(`Processing intent for Coach ${coachId} from ${sender}`);
        this.logger.log(`Email handling mode: ${emailHandlingMode}, Admin override: ${adminOverride?.enabled || false}`);

        const labelsToAdd = new Set<string>(['sqd-read']);

        try {
            // 0. Resolve Player ID from Sender Email
            let playerId: string | undefined;
            try {
                const player = await this.pythonAdapter.findPlayerByEmail(coachId, sender);
                if (player) {
                    playerId = player.id || player._id;
                    this.logger.log(`Resolved Player ID: ${playerId} for sender: ${sender}`);
                } else {
                    this.logger.log(`No existing player found for sender: ${sender}`);
                }
            } catch (e) {
                this.logger.warn(`Failed to lookup player for sender ${sender}`, e);
            }

            // 1. Analyze with Gemini
            const analysis = await this.geminiService.analyzeEmail(subject, emailContent, sender, coachId, playerId);

            this.logger.debug(`[LLM RAW ANALYSIS] ${JSON.stringify(analysis)}`);
            this.logger.log(`[LLM DECISION] Intent: ${analysis.intent} | Skills: ${analysis.skills_identified.join(', ')} | Confidence: ${analysis.confidence}`);

            if (analysis.intent === 'OTHER') {
                this.logger.log(`Skipping email from ${sender} - Intent: OTHER`);
                return;
            }

            let replyText = analysis.email_draft?.body || ''; // Default to LLM draft if valid
            let success = false;

            // 2. CHECK_SCHEDULE Logic
            if (analysis.intent === 'CHECK_SCHEDULE' || analysis.intent === 'MULTI_INTENT') {
                this.logger.log(`[SKILL EXEC] Executing Check Schedule Logic`);
                console.log(`[CHECK_SCHEDULE] Fetching schedule for ${sender}`);
                const schedule = await this.pythonAdapter.getPlayerSchedule(sender);
                const scheduleText = schedule.length > 0
                    ? schedule.map((s: any) => `- ${s.date} at ${s.time} with Coach ${s.coach}`).join('\n')
                    : 'You have no upcoming sessions scheduled.';

                // If intent was purely check schedule, override or append to draft
                const scheduleMsg = `Here is your schedule details:\n${scheduleText}`;
                replyText = replyText ? `${replyText}\n\n${scheduleMsg}` : `Here is your schedule:\n${scheduleText}`;
                success = true;
            }

            // 3. BOOK_LESSON Logic
            // If multi-intent, we append booking confirmation to schedule text
            if (analysis.intent === 'BOOK_LESSON' || analysis.intent === 'MULTI_INTENT') {
                const requests = analysis.requests || [];
                for (const req of requests) {
                    if (req.intent === 'BOOK_LESSON' && req.date && req.time) {
                        this.logger.log(`[SKILL EXEC] Executing Book Lesson Logic for ${req.date} @ ${req.time}`);

                        // Check availability
                        const slots = await this.pythonAdapter.findAvailability(coachId, req.date);
                        const targetSlot = slots?.find(s => s.start_time.startsWith(req.time) && s.is_available);

                        if (targetSlot) {
                            await this.pythonAdapter.createBooking({
                                coach_id: coachId,
                                player_id: playerId || "determined-from-sender-email", // Updated to use resolved ID
                                booking_date: req.date,
                                start_time: req.time,
                                end_time: "calculated-end",
                                status: "confirmed"
                            });
                            const bookingMsg = `Confirmed booking for ${req.date} at ${req.time}.`;
                            replyText = replyText ? `${replyText}\n\n${bookingMsg}` : bookingMsg;
                            success = true;
                        } else {
                            // Suggest alternatives
                            const alternatives = slots ? slots.filter(s => s.is_available).slice(0, 2) : [];
                            const altText = alternatives.map(s => s.start_time).join(' or ');
                            const failMsg = `Sorry, ${req.time} is not available on ${req.date}.` + (altText ? ` Try: ${altText}` : '');

                            replyText = replyText ? `${replyText}\n\n${failMsg}` : failMsg;
                            success = false;
                        }
                    }
                }
            }

            // 4. Determine recipient based on admin override
            const recipientEmail = adminOverride?.enabled && adminOverride.email
                ? adminOverride.email
                : sender;
            const originalSender = adminOverride?.enabled ? sender : undefined;

            // Get coach email for logging
            const coachEmail = await this.pythonAdapter.getCoachEmail(coachId);

            // 5. Send or Draft based on email handling mode (not success)
            if (replyText) {
                if (emailHandlingMode === 'send_full_replies') {
                    // Send the reply
                    await this.gmailService.sendReply(refreshToken, threadId, replyText, recipientEmail, subject);
                    labelsToAdd.add('SQD Handled');

                    // Log the sent email
                    await this.pythonAdapter.logEmail({
                        coach_id: coachId,
                        coach_email: coachEmail,
                        recipient_email: recipientEmail,
                        original_sender: originalSender,
                        subject: subject,
                        body: replyText,
                        email_type: 'sent',
                        handling_mode: emailHandlingMode,
                        admin_override_active: adminOverride?.enabled || false,
                        thread_id: threadId,
                    });

                    this.logger.log(`[ACTION: SENT] Sent reply to ${recipientEmail}`);
                } else {
                    // Draft only mode
                    await this.gmailService.createDraft(refreshToken, threadId, replyText, recipientEmail, subject);
                    labelsToAdd.add('SQD review pending');

                    // Log the drafted email
                    await this.pythonAdapter.logEmail({
                        coach_id: coachId,
                        coach_email: coachEmail,
                        recipient_email: recipientEmail,
                        original_sender: originalSender,
                        subject: subject,
                        body: replyText,
                        email_type: 'drafted',
                        handling_mode: emailHandlingMode,
                        admin_override_active: adminOverride?.enabled || false,
                        thread_id: threadId,
                    });

                    this.logger.log(`[ACTION: DRAFT] Created draft for ${recipientEmail}`);
                }
            }
        } catch (error) {
            this.logger.error('Error executing agent actions', error);
            labelsToAdd.add('SQD review pending');
        } finally {
            try {
                // Ensure labels are always applied (e.g. sqd-read)
                await this.gmailService.addLabels(refreshToken, threadId, Array.from(labelsToAdd), clientId, clientSecret);
            } catch (e) {
                this.logger.error('Failed to apply labels in finally block', e);
            }
        }
    }

    private filterSlotsByLocation(slots: AvailabilitySlot[], requiredLocationId: string): AvailabilitySlot[] {
        return slots;
    }
}
