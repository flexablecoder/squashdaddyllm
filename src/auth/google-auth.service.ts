import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';

@Injectable()
export class GoogleAuthService {
    private readonly logger = new Logger(GoogleAuthService.name);
    private oAuth2Client: InstanceType<typeof google.auth.OAuth2>;

    constructor(private readonly configService: ConfigService) {
        const clientId = this.configService.get<string>('GMAIL_CLIENT_ID');
        const clientSecret = this.configService.get<string>('GMAIL_CLIENT_SECRET');
        const redirectUri = this.configService.get<string>('GMAIL_REDIRECT_URI');

        if (!clientId || !clientSecret || !redirectUri) {
            this.logger.error('Missing required Gmail OAuth2 configuration');
            throw new Error('Gmail OAuth2 configuration is incomplete');
        }

        this.oAuth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            redirectUri,
        );

        this.logger.log('GoogleAuthService initialized successfully');
    }

    /**
     * Generates the Google OAuth2 authorization URL
     * @param coachId - The ID of the coach to authenticate
     * @returns Authorization URL to redirect the user to
     */
    generateAuthUrl(coachId: string): string {
        const authUrl = this.oAuth2Client.generateAuthUrl({
            access_type: 'offline', // Required to get refresh token
            prompt: 'consent', // Force consent screen to always get refresh token
            scope: ['https://www.googleapis.com/auth/gmail.modify'],
            state: coachId, // Pass coachId through the OAuth flow
        });

        this.logger.log(`Generated auth URL for coach ${coachId}`);
        return authUrl;
    }

    /**
     * Exchanges the authorization code for access and refresh tokens
     * @param code - Authorization code from Google callback
     * @returns Token response containing access_token, refresh_token, etc.
     */
    async exchangeCodeForTokens(code: string): Promise<{ [key: string]: any }> {
        try {
            const { tokens } = await this.oAuth2Client.getToken(code);
            this.logger.log('Successfully exchanged code for tokens');
            return tokens;
        } catch (error) {
            this.logger.error('Failed to exchange code for tokens', error);
            throw error;
        }
    }
}
