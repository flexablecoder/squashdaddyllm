
import { Injectable, HttpException, HttpStatus, OnModuleInit, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { IBookingSystem } from '../interfaces/booking-system.interface';
import { AvailabilitySlot } from '../../common/dtos/availability.dto';

@Injectable()
export class PythonApiAdapter implements IBookingSystem, OnModuleInit {
    private baseUrl: string;
    private apiClientId: string;
    private apiClientSecret: string;
    private accessToken: string | null = null;
    private tokenExpiry: number = 0; // Timestamp when token expires

    private readonly logger = new Logger(PythonApiAdapter.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        this.baseUrl = this.configService.get<string>('PYTHON_API_URL', 'http://localhost:8000');
        this.apiClientId = this.configService.get<string>('API_CLIENT_ID', '');
        this.apiClientSecret = this.configService.get<string>('API_CLIENT_SECRET', '');

        // LOGGING INTERCEPTORS
        this.httpService.axiosRef.interceptors.request.use(config => {
            const { method, url, data } = config;
            this.logger.debug(`[API REQ] ${method?.toUpperCase()} ${url} | Body: ${JSON.stringify(data || {})}`);
            return config;
        });

        this.httpService.axiosRef.interceptors.response.use(
            response => {
                const { status, config, data } = response;
                this.logger.debug(`[API RES] ${status} ${config.url} | Data: ${JSON.stringify(data || {}).substring(0, 500)}...`);
                return response;
            },
            error => {
                if (error.response) {
                    this.logger.error(`[API ERR] ${error.response.status} ${error.config?.url} | Data: ${JSON.stringify(error.response.data)}`);
                } else {
                    this.logger.error(`[API ERR] Network/Other: ${error.message}`);
                }
                return Promise.reject(error);
            }
        );

        // AUTH INTERCEPTORS (EXISTING)
        this.httpService.axiosRef.interceptors.request.use(async (config) => {
            // Skip auth for login endpoint to avoid loops
            if (config.url?.includes('/api/oauth/token')) {
                return config;
            }

            // Ensure we have a valid token
            await this.ensureAuthenticated();

            if (this.accessToken) {
                config.headers.Authorization = `Bearer ${this.accessToken}`;
            }
            return config;
        }, (error) => {
            return Promise.reject(error);
        });

        // Add response interceptor to handle 401s (token expiry)
        this.httpService.axiosRef.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;

                // If 401 and not already retried
                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;

                    try {
                        // Force token refresh
                        this.accessToken = null;
                        await this.authenticate();

                        // Update header and retry
                        originalRequest.headers.Authorization = `Bearer ${this.accessToken}`;
                        return this.httpService.axiosRef(originalRequest);
                    } catch (refreshError) {
                        return Promise.reject(refreshError);
                    }
                }
                return Promise.reject(error);
            }
        );
    }

    async onModuleInit() {
        console.log('PythonApiAdapter: Initializing...');
        console.log(`PythonApiAdapter: API_CLIENT_ID=${this.apiClientId}`);
        console.log(`PythonApiAdapter: API_CLIENT_SECRET=${this.apiClientSecret ? '***' + this.apiClientSecret.slice(-4) : 'UNDEFINED'}`);

        if (this.apiClientId && this.apiClientSecret) {
            console.log('Initializing Python API Adapter with M2M Auth...');
            try {
                await this.authenticate();
                console.log('Successfully authenticated with Python API');
            } catch (error) {
                console.error('Failed to authenticate with Python API on startup. Will retry on first request.', error.message);
            }
        } else {
            console.warn('API_CLIENT_ID or API_CLIENT_SECRET not set. M2M authentication disabled.');
        }
    }

    private async ensureAuthenticated() {
        // Buffer time of 5 minutes before actual expiry
        const now = Date.now();
        if (!this.accessToken || now >= this.tokenExpiry - 300000) {
            await this.authenticate();
        }
    }

    private async authenticate() {
        if (!this.apiClientId || !this.apiClientSecret) {
            console.warn('Cannot authenticate: Missing API_CLIENT_ID or API_CLIENT_SECRET');
            return;
        }

        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}/api/oauth/token`, {
                    grant_type: 'client_credentials',
                    client_id: this.apiClientId,
                    client_secret: this.apiClientSecret,
                })
            );

            this.accessToken = response.data.access_token;
            // Set expiry based on response (expires_in is in seconds)
            this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);

        } catch (error) {
            console.error('M2M Authentication failed:', error.response?.data || error.message);
            throw new Error('Failed to authenticate with backend API');
        }
    }

    async findAvailability(coachId: string, date: string): Promise<AvailabilitySlot[]> {
        try {
            await this.ensureAuthenticated();
            // Call the correct endpoint that returns time slots
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/api/coaches/${coachId}/availability`, {
                    params: { date: date }
                })
            );
            // Expecting response.data to be an array of slots like: [{start_time: '15:00', is_available: true}, ...]
            this.logger.debug(`[findAvailability] Date: ${date}, Slots: ${JSON.stringify(response.data)}`);
            return response.data || [];
        } catch (error) {
            this.logger.error(`[findAvailability] Error fetching availability for ${coachId} on ${date}`, error);
            this.handleError(error);
            return [];
        }
    }

    async createBooking(bookingDetails: any): Promise<any> {
        try {
            await this.ensureAuthenticated();
            const response = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}/api/bookings`, bookingDetails)
            );
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    async getAssignedPlayers(coachId: string): Promise<any[]> {
        try {
            await this.ensureAuthenticated();
            // Pass user_id to filter players for this specific coach context
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/api/coaches/me/players`, {
                    params: { user_id: coachId }
                })
            );
            return response.data;
        } catch (error) {
            this.handleError(error);
            return [];
        }
    }

    async getEnabledCoaches(): Promise<any[]> {
        try {
            await this.ensureAuthenticated();
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/api/admin/agent/coaches`)
            );
            return response.data;
        } catch (error) {
            console.error('Failed to fetch enabled coaches', error);
            return [];
        }
    }

    async getPlayerSchedule(playerEmail: string): Promise<any[]> {
        return [
            { id: '1', date: '2025-12-25', time: '10:00', coach: 'Nick' }
        ];
    }

    async findPlayerByEmail(coachId: string, email: string): Promise<any> {
        try {
            const players = await this.getAssignedPlayers(coachId);
            const player = players.find(p => p.email.toLowerCase() === email.toLowerCase());
            return player || null;
        } catch (error) {
            this.logger.warn(`Failed to find player by email ${email} for coach ${coachId}`, error);
            return null;
        }
    }

    async saveGmailIntegration(coachId: string, refreshToken: string): Promise<void> {
        try {
            await this.ensureAuthenticated();
            await firstValueFrom(
                this.httpService.patch(`${this.baseUrl}/api/coaches/${coachId}/integrations`, {
                    gmail_refresh_token: refreshToken,
                })
            );
        } catch (error) {
            this.handleError(error);
        }
    }

    async getSystemAdminSettings(): Promise<{ email_override_enabled: boolean; override_email_address: string | null }> {
        try {
            await this.ensureAuthenticated();
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/api/admin/system-settings`)
            );
            return {
                email_override_enabled: response.data.email_override_enabled || false,
                override_email_address: response.data.override_email_address || null,
            };
        } catch (error) {
            console.error('Failed to fetch system admin settings', error);
            return {
                email_override_enabled: false,
                override_email_address: null,
            };
        }
    }

    async logEmail(emailData: {
        coach_id: string;
        coach_email: string;
        recipient_email: string;
        original_sender?: string;
        subject: string;
        body: string;
        email_type: string;
        handling_mode: string;
        admin_override_active: boolean;
        thread_id?: string;
        message_id?: string;
    }): Promise<void> {
        try {
            await this.ensureAuthenticated();
            await firstValueFrom(
                this.httpService.post(`${this.baseUrl}/api/admin/email-logs`, emailData)
            );
        } catch (error) {
            console.error('Failed to log email', error);
        }
    }

    async getCoachEmail(coachId: string): Promise<string> {
        try {
            await this.ensureAuthenticated();
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/api/users/${coachId}`)
            );
            return response.data.email || '';
        } catch (error) {
            console.error(`Failed to fetch coach email for ${coachId}`, error);
            return '';
        }
    }

    private handleError(error: any) {
        if (error.response) {
            throw new HttpException(
                error.response.data?.detail || 'External API Error',
                error.response.status,
            );
        }
        throw new HttpException(error.message || 'Service Unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
}
