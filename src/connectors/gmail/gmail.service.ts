
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class GmailService {
    private oAuth2Client: OAuth2Client;

    constructor(private configService: ConfigService) {
        this.oAuth2Client = new google.auth.OAuth2(
            this.configService.get('GMAIL_CLIENT_ID'),
            this.configService.get('GMAIL_CLIENT_SECRET'),
            // Redirect URL not needed for service-level usage usually
        );
    }

    async getAuthenticatedClient(refreshToken: string) {
        this.oAuth2Client.setCredentials({ refresh_token: refreshToken });
        return google.gmail({ version: 'v1', auth: this.oAuth2Client });
    }

    async fetchUnreadMessages(coachRefreshToken: string, query: string) {
        const gmail = await this.getAuthenticatedClient(coachRefreshToken);
        const res = await gmail.users.messages.list({
            userId: 'me',
            q: `is:unread ${query}`,
        });

        const messages = res.data.messages || [];
        const details = await Promise.all(
            messages.map(async (msg) => {
                const fullMsg = await gmail.users.messages.get({
                    userId: 'me',
                    id: msg.id,
                });
                // Parsing logic would go here (headers, body snippet)
                return {
                    id: msg.id,
                    threadId: msg.threadId,
                    snippet: fullMsg.data.snippet
                };
            }),
        );
        return details;
    }

    async sendReply(coachRefreshToken: string, threadId: string, text: string) {
        const gmail = await this.getAuthenticatedClient(coachRefreshToken);
        // Implementation of creating MIME message and sending
        // Stubbed for brevity in this step
        console.log(`Sending reply to thread ${threadId}: ${text}`);
        return { sent: true };
    }

    async getUnreadThreads(refreshToken: string) {
        const gmail = await this.getAuthenticatedClient(refreshToken);

        // List threads with unread messages
        const res = await gmail.users.threads.list({
            userId: 'me',
            q: 'is:unread',
        });

        const threadsList = res.data.threads || [];
        const threads = await Promise.all(
            threadsList.map(async (t) => {
                const fullThread = await gmail.users.threads.get({
                    userId: 'me',
                    id: t.id,
                    format: 'full', // Get full content
                });
                return fullThread.data;
            }),
        );
        return threads;
    }
}
