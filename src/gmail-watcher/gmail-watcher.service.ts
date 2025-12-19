
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
            // 1. Get enabled coaches
            const coaches = await this.pythonAdapter.getEnabledCoaches();
            this.logger.log(`Found ${coaches.length} enabled coaches.`);

            // 2. Iterate and process
            for (const coach of coaches) {
                await this.processCoachInbox(coach);
            }
        } catch (error) {
            this.logger.error('Error in polling cycle', error);
        }
    }

    private async processCoachInbox(coach: any) {
        try {
            const coachId = coach._id || coach.id; // Handle Python ObjectId
            const email = coach.email;
            this.logger.debug(`Checking inbox for coach ${email} (${coachId})`);

            // 3. Fetch Unread
            const credentials = coach.agent_config?.gmail_credentials;
            if (!credentials || !credentials.refresh_token) {
                this.logger.warn(`No Gmail credentials for coach ${email}`);
                // return; 
            }

            // Using GmailService to fetch unread threads
            const refreshToken = credentials?.refresh_token || 'MOCK_TOKEN'; // Fallback for dev
            const threads = await this.gmailService.getUnreadThreads(refreshToken);

            for (const thread of threads) {
                // Process only the last message for now
                if (!thread.messages || thread.messages.length === 0) continue;
                const lastMsg = thread.messages[thread.messages.length - 1];

                // Extract headers safely
                const fromHeader = lastMsg.payload?.headers?.find((h: any) => h.name === 'From');
                const subjectHeader = lastMsg.payload?.headers?.find((h: any) => h.name === 'Subject');

                if (!fromHeader) {
                    this.logger.warn(`Skipping message ${lastMsg.id} - No From header`);
                    continue;
                }

                await this.orchestrator.processEmailIntent(
                    coachId,
                    lastMsg.snippet, // TODO: Get full body
                    fromHeader.value,
                    subjectHeader ? subjectHeader.value : 'No Subject',
                    refreshToken
                );
            }

        } catch (error) {
            this.logger.error(`Error processing inbox for coach ${coach.email}`, error);
        }
    }
}
