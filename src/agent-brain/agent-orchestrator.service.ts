
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
            // 0. Two-Step Player Verification
            // Step 1: Check if player exists in system at all (global lookup)
            let playerExistsGlobally = false;
            let playerConnectedToCoach = false;
            let playerId: string | undefined;
            
            try {
                // Step 1: Global player lookup
                const globalPlayer = await this.pythonAdapter.lookupPlayerByEmail(sender);
                playerExistsGlobally = !!globalPlayer;
                
                if (globalPlayer) {
                    this.logger.log(`Player exists in system: ${globalPlayer._id || globalPlayer.id}`);
                    
                    // Step 2: Check if connected to this specific coach
                    const connectedPlayer = await this.pythonAdapter.findPlayerByEmail(coachId, sender);
                    playerConnectedToCoach = !!connectedPlayer;
                    
                    if (connectedPlayer) {
                        playerId = connectedPlayer.id || connectedPlayer._id;
                        this.logger.log(`Player connected to coach: ${playerId}`);
                    } else {
                        this.logger.log(`Player exists but NOT connected to coach ${coachId}`);
                    }
                } else {
                    this.logger.log(`Player does not exist in system for sender: ${sender}`);
                }
            } catch (e) {
                this.logger.warn(`Failed during player verification for sender ${sender}`, e);
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
                // EARLY EXIT: Two-step verification
                // Case 1: Player not registered in system at all
                if (!playerExistsGlobally) {
                    this.logger.log(`[BOOK_LESSON] Player not registered - sending registration email`);
                    replyText = `Hi,

Thank you for reaching out! I'd love to help you schedule a training session.

However, you don't appear to have an account in our system yet. Please register at:

http://squashdaddy.com/register

Once registered, you can request to connect with your coach and I'll be able to help schedule your training.

Thanks,
SquashDaddy Agent`;
                    success = true;
                } 
                // Case 2: Player registered but not connected to this coach
                else if (!playerConnectedToCoach) {
                    this.logger.log(`[BOOK_LESSON] Player not connected to coach - sending connection pending email`);
                    replyText = `Hi,

I see you have an account but you're not yet connected with this coach.

Your connection request may be pending approval. Once the coach accepts your connection, I'll be able to help you schedule training sessions.

If you haven't sent a connection request yet, please visit your dashboard at:

http://squashdaddy.com/dashboard

Thanks,
SquashDaddy Agent`;
                    success = true;
                } else {
                    // Player is known, proceed with booking logic
                    const requests = analysis.requests || [];
                    for (const req of requests) {
                        if (req.intent === 'BOOK_LESSON' && req.date) {
                            // Normalize date to YYYY-MM-DD format
                            let normalizedDate = req.date;
                            if (!/^\d{4}-\d{2}-\d{2}$/.test(req.date)) {
                            // Handle relative day names (friday, saturday, etc.)
                            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                            const lowerDate = req.date.toLowerCase();
                            const dayIndex = dayNames.findIndex(d => lowerDate.includes(d));
                            
                            if (dayIndex !== -1) {
                                // Calculate next occurrence of that day
                                const today = new Date();
                                const currentDay = today.getDay();
                                let daysUntil = dayIndex - currentDay;
                                if (daysUntil <= 0) daysUntil += 7; // Next week if today or past
                                
                                const targetDate = new Date(today);
                                targetDate.setDate(today.getDate() + daysUntil);
                                normalizedDate = targetDate.toISOString().split('T')[0];
                                this.logger.log(`[DATE NORMALIZATION] Day name '${req.date}' -> '${normalizedDate}'`);
                            } else {
                                // Try standard date parsing
                                const parsedDate = new Date(req.date);
                                if (!isNaN(parsedDate.getTime())) {
                                    normalizedDate = parsedDate.toISOString().split('T')[0];
                                    this.logger.log(`[DATE NORMALIZATION] Parsed '${req.date}' -> '${normalizedDate}'`);
                                } else {
                                    this.logger.warn(`[DATE NORMALIZATION] Could not parse date: '${req.date}'`);
                                }
                            }
                        }
                        
                        this.logger.log(`[DEBUG] LLM Request: date=${normalizedDate}, time=${req.time}, range=${req.time_range_start}-${req.time_range_end}`);
                        
                        // Check availability
                        const slots = await this.pythonAdapter.findAvailability(coachId, normalizedDate);
                        this.logger.log(`[DEBUG] findAvailability returned ${slots?.length || 0} slots: ${JSON.stringify(slots?.slice(0, 5))}`);
                        
                        let targetSlot;

                        // Check if time is in valid HH:MM format (e.g., "15:00", "09:30")
                        const isValidTimeFormat = req.time && /^\d{1,2}:\d{2}$/.test(req.time);

                        // Tier 1: Exact Match (Strict) - ONLY if time is valid HH:MM
                        if (isValidTimeFormat) {
                            this.logger.log(`[SKILL EXEC] Executing Book Lesson Logic for ${normalizedDate} @ ${req.time} (Strict)`);
                            targetSlot = slots?.find(s => s.start_time.startsWith(req.time) && s.is_available);
                        }
                        
                        // If no slot found yet, use Flexible Logic
                        if (!targetSlot) {
                            // Tier 2: Range Match
                            if (req.time_range_start) {
                                this.logger.log(`[SKILL EXEC] Executing Book Lesson Logic for ${normalizedDate} between ${req.time_range_start} and ${req.time_range_end || '23:59'}`);
                                const endRange = req.time_range_end || '23:59';
                                targetSlot = slots?.find(s => 
                                    s.is_available && 
                                    s.start_time >= req.time_range_start! && 
                                    s.start_time < endRange
                                );
                            }

                            // Tier 3: First Available Fallback
                            if (!targetSlot) {
                                this.logger.log(`[SKILL EXEC] Executing Book Lesson Logic for ${normalizedDate} (First Available Fallback)`);
                                targetSlot = slots?.find(s => s.is_available);
                            }
                        }

                        if (targetSlot) {
                            // Calculate end time (default 60 mins)
                            const [hours, minutes] = targetSlot.start_time.split(':').map(Number);
                            const endHour = hours + 1;
                            const endTime = `${endHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

                            await this.pythonAdapter.createBooking({
                                coach_id: coachId,
                                player_id: playerId || "determined-from-sender-email", 
                                booking_date: normalizedDate,
                                start_time: targetSlot.start_time,
                                end_time: endTime,
                                status: "confirmed"
                            });

                            // Calculate alternatives (excluding the booked slot) - show up to 4
                            const alternatives = slots ? slots.filter(s => s.is_available && s.start_time !== targetSlot.start_time).slice(0, 4) : [];
                            const altText = alternatives.length > 0 
                                ? `\n\nAlternative times available for ${normalizedDate}: ${alternatives.map(s => s.start_time).join(', ')}.` 
                                : '';

                            // Determine if we had to fall back from their preference
                            const wasPreferenceMissed = req.time || req.time_range_start;
                            const fallbackNote = wasPreferenceMissed 
                                ? `The coach doesn't have availability at your preferred time. ` 
                                : '';

                            // Overwrite replyText with clear confirmation (discarding LLM draft)
                            replyText = `Hi,\n\n${fallbackNote}Earliest available slot is ${targetSlot.start_time}. I have created a booking for ${normalizedDate} at ${targetSlot.start_time} to ensure you have a time reserved.${altText}\n\nIf none of these times work, let me know and we can look at different dates.\n\nThanks,\nSquashDaddy Agent`;
                            success = true;
                        } else {
                            // Suggest alternatives - show more slots
                            const alternatives = slots ? slots.filter(s => s.is_available).slice(0, 4) : [];
                            const altText = alternatives.map(s => s.start_time).join(', ');
                            const timeDesc = req.time ? req.time : (req.time_range_start ? `between ${req.time_range_start} and ${req.time_range_end}` : 'that day');
                            
                            // OVERWRITE replyText instead of appending (to avoid conflicting messages)
                            replyText = `Hi,\n\nSorry, no availability ${timeDesc} on ${normalizedDate}.` + 
                                (altText ? ` Available times: ${altText}.` : ' No slots available on this date.') +
                                `\n\nLet me know if you'd like to book one of these times or explore different dates.\n\nThanks,\nSquashDaddy Agent`;
                            success = false;
                        }
                    } // close if (req.intent === 'BOOK_LESSON')
                } // close for loop
                } // close 'else' block for known player
            } // close if (BOOK_LESSON || MULTI_INTENT)

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
