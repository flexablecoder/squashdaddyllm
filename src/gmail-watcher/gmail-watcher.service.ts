
import { Injectable, Logger } from '@nestjs/common';
import { PythonApiAdapter } from '../core/adapters/python-api.adapter';
import { GmailService } from '../connectors/gmail/gmail.service';
import { AgentOrchestrator } from '../agent-brain/agent-orchestrator.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GmailWatcherService {
    private readonly logger = new Logger(GmailWatcherService.name);

    constructor(
        private readonly pythonAdapter: PythonApiAdapter,
        private readonly gmailService: GmailService,
        private readonly orchestrator: AgentOrchestrator,
        private readonly configService: ConfigService
    ) { }

    async checkAllInboxes() {
        this.logger.log('Starting polling cycle for all agent-enabled coaches...');

        try {
            // 1. Fetch system admin settings (once per cycle)
            const systemSettings = await this.pythonAdapter.getSystemAdminSettings();
            this.logger.log(`System settings - Override: ${systemSettings.email_override_enabled}, Email: ${systemSettings.override_email_address}`);

            // 2. Get enabled coaches
            const coaches = await this.pythonAdapter.getEnabledCoaches();
            this.logger.log(`Found ${coaches.length} enabled coaches.`);

            // 3. Iterate and process
            for (const coach of coaches) {
                await this.processCoachInbox(coach, systemSettings);
            }
        } catch (error) {
            this.logger.error('Error in polling cycle', error);
        }
    }

    private async processCoachInbox(
        coach: any,
        systemSettings: { email_override_enabled: boolean; override_email_address: string | null }
    ) {
        try {
            const coachId = coach._id || coach.id; // Handle Python ObjectId
            const email = coach.email;
            this.logger.debug(`Checking inbox for coach ${email} (${coachId})`);

            // 3. Fetch Unread
            const credentials = coach.gmail_credentials; // Python endpoint returns credentials at root level
            if (!credentials || !credentials.refresh_token) {
                this.logger.warn(`No Gmail credentials for coach ${email}`);
                return; // Skip if no credentials
            }

            // Extract OAuth credentials
            const refreshToken = credentials.refresh_token;
            const clientId = credentials.client_id;
            const clientSecret = credentials.client_secret;

            // Get coach's email handling mode (default to draft_only if not set)
            const emailHandlingMode = coach.email_handling_mode || 'draft_only';

            // Prepare admin override object
            const adminOverride = systemSettings.email_override_enabled && systemSettings.override_email_address
                ? { enabled: true, email: systemSettings.override_email_address }
                : null;

            // Using GmailService to fetch unread threads with coach-specific credentials
            const threads = await this.gmailService.getUnreadThreads(refreshToken, clientId, clientSecret);

            let stats = {
                found: threads.length,
                processed: 0,
                skipped: 0
            };

            this.logger.log(`Found ${stats.found} unread threads for coach ${email}`);

            for (const thread of threads) {
                // Process only the last message for now
                if (!thread.messages || thread.messages.length === 0) {
                    stats.skipped++;
                    continue;
                }
                const lastMsg = thread.messages[thread.messages.length - 1];

                // Extract headers safely
                const fromHeader = lastMsg.payload?.headers?.find((h: any) => h.name === 'From');
                const subjectHeader = lastMsg.payload?.headers?.find((h: any) => h.name === 'Subject');

                if (!fromHeader) {
                    this.logger.warn(`Skipping message ${lastMsg.id} - No From header`);
                    stats.skipped++;
                    continue;
                }

                await this.orchestrator.processEmailIntent(
                    coachId,
                    lastMsg.snippet, // TODO: Get full body
                    fromHeader.value,
                    subjectHeader ? subjectHeader.value : 'No Subject',
                    refreshToken,
                    thread.id,
                    emailHandlingMode as 'draft_only' | 'send_full_replies',
                    adminOverride
                );

                stats.processed++;
            }

            this.logger.log(`Inbox processing complete for ${email}: Found=${stats.found}, Processed=${stats.processed}, Skipped=${stats.skipped}`);

        } catch (error) {
            this.logger.error(`Error processing inbox for coach ${coach.email}`, error);
        }
    }
}
