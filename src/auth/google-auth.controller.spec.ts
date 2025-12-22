import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { GoogleAuthController } from './google-auth.controller';
import { GoogleAuthService } from './google-auth.service';
import { PythonApiAdapter } from '../core/adapters/python-api.adapter';

describe('GoogleAuthController', () => {
    let controller: GoogleAuthController;
    let googleAuthService: GoogleAuthService;
    let pythonApiAdapter: PythonApiAdapter;

    const mockGoogleAuthService = {
        generateAuthUrl: jest.fn(),
        exchangeCodeForTokens: jest.fn(),
    };

    const mockPythonApiAdapter = {
        saveGmailIntegration: jest.fn(),
    };

    const mockConfigService = {
        get: jest.fn((key: string, defaultValue?: string) => {
            if (key === 'FRONTEND_URL') return 'http://localhost:3000';
            return defaultValue;
        }),
    };

    const mockResponse = () => {
        const res: any = {};
        res.redirect = jest.fn().mockReturnValue(res);
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        return res as Response;
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [GoogleAuthController],
            providers: [
                {
                    provide: GoogleAuthService,
                    useValue: mockGoogleAuthService,
                },
                {
                    provide: PythonApiAdapter,
                    useValue: mockPythonApiAdapter,
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        controller = module.get<GoogleAuthController>(GoogleAuthController);
        googleAuthService = module.get<GoogleAuthService>(GoogleAuthService);
        pythonApiAdapter = module.get<PythonApiAdapter>(PythonApiAdapter);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('connect', () => {
        it('should redirect to Google OAuth URL', async () => {
            const coachId = 'coach-123';
            const authUrl = 'https://accounts.google.com/o/oauth2/auth?...';
            const res = mockResponse();

            mockGoogleAuthService.generateAuthUrl.mockReturnValue(authUrl);

            await controller.connect(coachId, res);

            expect(mockGoogleAuthService.generateAuthUrl).toHaveBeenCalledWith(coachId);
            expect(res.redirect).toHaveBeenCalledWith(authUrl);
        });

        it('should handle errors and redirect to frontend with error', async () => {
            const coachId = 'coach-123';
            const res = mockResponse();

            mockGoogleAuthService.generateAuthUrl.mockImplementation(() => {
                throw new Error('OAuth init failed');
            });

            await controller.connect(coachId, res);

            expect(res.redirect).toHaveBeenCalledWith(
                expect.stringContaining('/settings?status=error&message=oauth_init_failed')
            );
        });
    });

    describe('callback', () => {
        it('should handle successful OAuth callback', async () => {
            const code = 'auth-code-123';
            const state = 'coach-456';
            const res = mockResponse();

            const mockTokens = {
                access_token: 'access-token',
                refresh_token: 'refresh-token',
                expiry_date: Date.now() + 3600000,
            };

            mockGoogleAuthService.exchangeCodeForTokens.mockResolvedValue(mockTokens);
            mockPythonApiAdapter.saveGmailIntegration.mockResolvedValue(undefined);

            await controller.callback(code, state, res);

            expect(mockGoogleAuthService.exchangeCodeForTokens).toHaveBeenCalledWith(code);
            expect(mockPythonApiAdapter.saveGmailIntegration).toHaveBeenCalledWith(
                state,
                'refresh-token'
            );
            expect(res.redirect).toHaveBeenCalledWith(
                expect.stringContaining('/settings?status=success')
            );
        });

        it('should handle missing code parameter', async () => {
            const code = '';
            const state = 'coach-456';
            const res = mockResponse();

            await controller.callback(code, state, res);

            expect(res.redirect).toHaveBeenCalledWith(
                expect.stringContaining('/settings?status=error&message=missing_parameters')
            );
            expect(mockGoogleAuthService.exchangeCodeForTokens).not.toHaveBeenCalled();
        });

        it('should handle missing state parameter', async () => {
            const code = 'auth-code-123';
            const state = '';
            const res = mockResponse();

            await controller.callback(code, state, res);

            expect(res.redirect).toHaveBeenCalledWith(
                expect.stringContaining('/settings?status=error&message=missing_parameters')
            );
            expect(mockGoogleAuthService.exchangeCodeForTokens).not.toHaveBeenCalled();
        });

        it('should handle missing refresh token in response', async () => {
            const code = 'auth-code-123';
            const state = 'coach-456';
            const res = mockResponse();

            // Mock tokens without refresh_token - this happens when user has already
            // authorized the app and consent screen was skipped
            const mockTokensWithoutRefresh = {
                access_token: 'access-token',
                expiry_date: Date.now() + 3600000,
                // refresh_token is missing
            };

            mockGoogleAuthService.exchangeCodeForTokens.mockResolvedValue(mockTokensWithoutRefresh);

            await controller.callback(code, state, res);

            expect(mockGoogleAuthService.exchangeCodeForTokens).toHaveBeenCalledWith(code);
            expect(mockPythonApiAdapter.saveGmailIntegration).not.toHaveBeenCalled();
            expect(res.redirect).toHaveBeenCalledWith(
                expect.stringContaining('/settings?status=error&message=no_refresh_token')
            );
        });

        it('should handle Python API errors', async () => {
            const code = 'auth-code-123';
            const state = 'coach-456';
            const res = mockResponse();

            const mockTokens = {
                access_token: 'access-token',
                refresh_token: 'refresh-token',
                expiry_date: Date.now() + 3600000,
            };

            mockGoogleAuthService.exchangeCodeForTokens.mockResolvedValue(mockTokens);
            mockPythonApiAdapter.saveGmailIntegration.mockRejectedValue(
                new Error('Python API unavailable')
            );

            await controller.callback(code, state, res);

            expect(res.redirect).toHaveBeenCalledWith(
                expect.stringContaining('/settings?status=error&message=callback_failed')
            );
        });

        it('should handle token exchange errors', async () => {
            const code = 'invalid-code';
            const state = 'coach-456';
            const res = mockResponse();

            mockGoogleAuthService.exchangeCodeForTokens.mockRejectedValue(
                new Error('Invalid authorization code')
            );

            await controller.callback(code, state, res);

            expect(mockPythonApiAdapter.saveGmailIntegration).not.toHaveBeenCalled();
            expect(res.redirect).toHaveBeenCalledWith(
                expect.stringContaining('/settings?status=error&message=callback_failed')
            );
        });
    });
});
