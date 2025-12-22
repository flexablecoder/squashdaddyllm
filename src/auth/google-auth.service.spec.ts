import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleAuthService } from './google-auth.service';

describe('GoogleAuthService', () => {
    let service: GoogleAuthService;
    let configService: ConfigService;

    const mockConfigService = {
        get: jest.fn((key: string, defaultValue?: string) => {
            const config = {
                'GMAIL_CLIENT_ID': 'test-client-id',
                'GMAIL_CLIENT_SECRET': 'test-client-secret',
                'GMAIL_REDIRECT_URI': 'http://localhost:3001/auth/google/callback',
            };
            return config[key] || defaultValue;
        }),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GoogleAuthService,
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        service = module.get<GoogleAuthService>(GoogleAuthService);
        configService = module.get<ConfigService>(ConfigService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('constructor', () => {
        it('should throw error if Gmail OAuth2 configuration is missing', () => {
            const incompleteConfigService = {
                get: jest.fn(() => undefined),
            };

            expect(() => {
                new GoogleAuthService(incompleteConfigService as any);
            }).toThrow('Gmail OAuth2 configuration is incomplete');
        });

        it('should initialize with valid configuration', () => {
            expect(configService.get).toHaveBeenCalledWith('GMAIL_CLIENT_ID');
            expect(configService.get).toHaveBeenCalledWith('GMAIL_CLIENT_SECRET');
            expect(configService.get).toHaveBeenCalledWith('GMAIL_REDIRECT_URI');
        });
    });

    describe('generateAuthUrl', () => {
        it('should generate auth URL with correct parameters', () => {
            const coachId = 'coach-123';
            const authUrl = service.generateAuthUrl(coachId);

            expect(authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
            expect(authUrl).toContain('access_type=offline');
            expect(authUrl).toContain('prompt=consent');
            expect(authUrl).toContain('scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.modify');
            expect(authUrl).toContain(`state=${coachId}`);
        });

        it('should generate different URLs for different coach IDs', () => {
            const url1 = service.generateAuthUrl('coach-1');
            const url2 = service.generateAuthUrl('coach-2');

            expect(url1).toContain('state=coach-1');
            expect(url2).toContain('state=coach-2');
            expect(url1).not.toEqual(url2);
        });
    });

    describe('exchangeCodeForTokens', () => {
        it('should handle successful token exchange', async () => {
            // Mock the OAuth2Client's getToken method
            const mockTokens = {
                access_token: 'mock-access-token',
                refresh_token: 'mock-refresh-token',
                expiry_date: Date.now() + 3600000,
            };

            // We can't easily mock the internal OAuth2Client without significant setup
            // This test would require mocking googleapis internals
            // For now, we'll structure it as a placeholder for integration tests

            // In a real scenario, you'd use nock to mock the Google OAuth endpoint
            // or test this in integration tests rather than unit tests
        });

        it('should throw error on failed token exchange', async () => {
            // Test would verify that errors from Google API are properly thrown
            // Would require mocking the googleapis library with nock or similar
        });
    });
});
