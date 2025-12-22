import { Controller, Get, Param, Query, Res, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { GoogleAuthService } from './google-auth.service';
import { PythonApiAdapter } from '../core/adapters/python-api.adapter';
import { ConfigService } from '@nestjs/config';

@Controller('auth/google')
export class GoogleAuthController {
    private readonly logger = new Logger(GoogleAuthController.name);
    private readonly frontendUrl: string;

    constructor(
        private readonly googleAuthService: GoogleAuthService,
        private readonly pythonApiAdapter: PythonApiAdapter,
        private readonly configService: ConfigService,
    ) {
        this.frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    }

    /**
     * Initiates the Google OAuth2 flow for a coach
     * GET /auth/google/connect/:coachId
     */
    @Get('connect/:coachId')
    async connect(@Param('coachId') coachId: string, @Res() res: Response) {
        try {
            this.logger.log(`Initiating Google OAuth for coach ${coachId}`);
            const authUrl = this.googleAuthService.generateAuthUrl(coachId);
            return res.redirect(authUrl);
        } catch (error) {
            this.logger.error(`Failed to initiate OAuth for coach ${coachId}`, error);
            return res.redirect(`${this.frontendUrl}/settings?status=error&message=oauth_init_failed`);
        }
    }

    /**
     * Handles the OAuth2 callback from Google
     * GET /auth/google/callback?code=...&state=...
     */
    @Get('callback')
    async callback(
        @Query('code') code: string,
        @Query('state') state: string, // This is our coachId
        @Res() res: Response,
    ) {
        try {
            // Validate required parameters
            if (!code || !state) {
                this.logger.error('Missing code or state parameter in OAuth callback');
                return res.redirect(`${this.frontendUrl}/settings?status=error&message=missing_parameters`);
            }

            const coachId = state;
            this.logger.log(`Processing OAuth callback for coach ${coachId}`);

            // Exchange authorization code for tokens
            const tokens = await this.googleAuthService.exchangeCodeForTokens(code);

            // Validate that we received a refresh token
            if (!tokens.refresh_token) {
                this.logger.error(`No refresh token received for coach ${coachId}. This typically means the user has already authorized the app. User may need to revoke access and try again.`);
                return res.redirect(`${this.frontendUrl}/settings?status=error&message=no_refresh_token`);
            }

            // Save the refresh token to the Python API
            await this.pythonApiAdapter.saveGmailIntegration(coachId, tokens.refresh_token);

            this.logger.log(`Successfully saved Gmail integration for coach ${coachId}`);
            return res.redirect(`${this.frontendUrl}/settings?status=success`);

        } catch (error) {
            this.logger.error('Error in OAuth callback', error);
            return res.redirect(`${this.frontendUrl}/settings?status=error&message=callback_failed`);
        }
    }
}
