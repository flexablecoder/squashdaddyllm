
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';

@Injectable()
export class GmailService {
    constructor(private configService: ConfigService) { }

    /**
     * Create an OAuth2 client with the provided credentials
     * This allows each coach to have their own OAuth client with their specific credentials
     */
    private createOAuth2Client(clientId: string, clientSecret: string) {
        return new google.auth.OAuth2(
            clientId,
            clientSecret,
            // Redirect URL not needed for service-level usage
        );
    }

    async getAuthenticatedClient(refreshToken: string, clientId?: string, clientSecret?: string) {
        // Use provided credentials or fall back to environment variables (for backwards compatibility)
        const effectiveClientId = clientId || this.configService.get('GMAIL_CLIENT_ID');
        const effectiveClientSecret = clientSecret || this.configService.get('GMAIL_CLIENT_SECRET');

        const oAuth2Client = this.createOAuth2Client(effectiveClientId, effectiveClientSecret);
        oAuth2Client.setCredentials({ refresh_token: refreshToken });
        return google.gmail({ version: 'v1', auth: oAuth2Client });
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

    async sendReply(coachRefreshToken: string, threadId: string, text: string, recipientEmail: string, subject: string) {
        const gmail = await this.getAuthenticatedClient(coachRefreshToken);

        // Dev Safety Check
        const isProd = process.env.NODE_ENV === 'production';
        const finalRecipient = isProd ? recipientEmail : 'squashdaddytestreply@gmail.com';

        console.log(`Sending reply to ${finalRecipient} (Original: ${recipientEmail}) [Dev Safe: ${!isProd}]`);

        const message = [
            'Content-Type: text/plain; charset="UTF-8"\n',
            'MIME-Version: 1.0\n',
            'Content-Transfer-Encoding: 7bit\n',
            `to: ${finalRecipient}\n`,
            `subject: Re: ${subject}\n`,
            '\n',
            text
        ].join('');

        const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage,
                threadId: threadId
            }
        });

        return { sent: true };
    }

    async createDraft(coachRefreshToken: string, threadId: string, text: string, recipientEmail: string, subject: string) {
        const gmail = await this.getAuthenticatedClient(coachRefreshToken);

        // Drafts should also respect dev safety to avoid accidental sends if manually approved? 
        // Actually drafts are safe, but let's keep it consistent or use real recipient for draft so coach sees real person?
        // Let's use real recipient for drafts so coach knows who it's for, as it's not sent yet.

        const message = [
            'Content-Type: text/plain; charset="UTF-8"\n',
            'MIME-Version: 1.0\n',
            'Content-Transfer-Encoding: 7bit\n',
            `to: ${recipientEmail}\n`,
            `subject: Re: ${subject}\n`,
            '\n',
            text
        ].join('');

        const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        await gmail.users.drafts.create({
            userId: 'me',
            requestBody: {
                message: {
                    raw: encodedMessage,
                    threadId: threadId
                }
            }
        });

        return { created: true };
    }

    async addLabels(coachRefreshToken: string, threadId: string, labelNames: string[]) {
        const gmail = await this.getAuthenticatedClient(coachRefreshToken);

        // 1. Get existing labels to find IDs
        const res = await gmail.users.labels.list({ userId: 'me' });
        const existingLabels = res.data.labels || [];
        const labelIdsToAdd: string[] = [];

        for (const name of labelNames) {
            let label = existingLabels.find(l => l.name === name);

            // Create if not exists
            if (!label) {
                try {
                    const newLabel = await gmail.users.labels.create({
                        userId: 'me',
                        requestBody: {
                            name: name,
                            labelListVisibility: 'labelShow',
                            messageListVisibility: 'show'
                        }
                    });
                    if (newLabel.data.id) labelIdsToAdd.push(newLabel.data.id);
                } catch (e) {
                    console.error(`Failed to create label ${name}`, e);
                }
            } else {
                if (label.id) labelIdsToAdd.push(label.id);
            }
        }

        if (labelIdsToAdd.length > 0) {
            await gmail.users.threads.modify({
                userId: 'me',
                id: threadId,
                requestBody: {
                    addLabelIds: labelIdsToAdd
                }
            });
        }
    }

    async getUnreadThreads(refreshToken: string, clientId?: string, clientSecret?: string) {
        const gmail = await this.getAuthenticatedClient(refreshToken, clientId, clientSecret);

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
