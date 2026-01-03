
import { Injectable, HttpException, HttpStatus, OnModuleInit, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { IBookingSystem } from '../interfaces/booking-system.interface';
import { AvailabilitySlot } from '../../common/dtos/availability.dto';
import { calculateAvailableSlots, getAvailableSlotsOnly } from '../utils/availability.utils';

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
                this.logger.debug(`[AUTH] Token attached to request: ${config.url}`);
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

                // If 401 and not already retried, and not the oauth endpoint
                if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/api/oauth/token')) {
                    originalRequest._retry = true;
                    this.logger.warn(`[AUTH] 401 received, refreshing token for: ${originalRequest.url}`);

                    try {
                        // Force token refresh
                        this.accessToken = null;
                        this.tokenExpiry = 0;
                        await this.authenticate();
                        
                        this.logger.log(`[AUTH] Token refreshed, retrying request: ${originalRequest.url}`);

                        // Update header and retry
                        originalRequest.headers.Authorization = `Bearer ${this.accessToken}`;
                        return this.httpService.axiosRef(originalRequest);
                    } catch (refreshError) {
                        this.logger.error(`[AUTH] Token refresh failed`, refreshError);
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

    /**
     * Get coach's weekly availability schedule
     * Endpoint: GET /api/availability?coach_id=X
     */
    async getCoachSchedule(coachId: string): Promise<any[]> {
        try {
            await this.ensureAuthenticated();
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/api/availability`, {
                    params: { coach_id: coachId }
                })
            );
            this.logger.debug(`[getCoachSchedule] Coach: ${coachId}, Schedule: ${JSON.stringify(response.data)}`);
            return response.data || [];
        } catch (error) {
            this.logger.error(`[getCoachSchedule] Error fetching schedule for ${coachId}`, error);
            this.handleError(error);
            return [];
        }
    }

    /**
     * Get bookings for a coach, optionally filtered by date range
     * Endpoint: GET /api/bookings?coach_id=X&view_mode=coach&start_date=X&end_date=X
     */
    async getBookings(coachId: string, startDate?: string, endDate?: string): Promise<any[]> {
        try {
            await this.ensureAuthenticated();
            const params: any = { 
                coach_id: coachId,
                view_mode: 'coach'
            };
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;
            
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/api/bookings`, { params })
            );
            this.logger.debug(`[getBookings] Coach: ${coachId}, Range: ${startDate}-${endDate}, Count: ${response.data?.length}`);
            return response.data || [];
        } catch (error) {
            this.logger.error(`[getBookings] Error fetching bookings for ${coachId}`, error);
            this.handleError(error);
            return [];
        }
    }

    /**
     * Find available booking slots for a date or date range
     * Combines coach schedule with existing bookings
     */
    async findAvailability(coachId: string, startDate: string, endDate?: string): Promise<AvailabilitySlot[]> {
        try {
            // Fetch schedule and bookings in parallel
            const [schedule, bookings] = await Promise.all([
                this.getCoachSchedule(coachId),
                this.getBookings(coachId, startDate, endDate || startDate)
            ]);

            // Calculate available slots
            const allSlots = calculateAvailableSlots(schedule, bookings, startDate, endDate);
            const availableSlots = getAvailableSlotsOnly(allSlots);
            
            this.logger.debug(`[findAvailability] Date: ${startDate}${endDate ? '-' + endDate : ''}, Available: ${availableSlots.length} slots`);
            
            // Convert to expected format
            return availableSlots.map(slot => ({
                start_time: slot.start_time,
                is_available: slot.is_available,
                date: slot.date
            }));
        } catch (error) {
            this.logger.error(`[findAvailability] Error calculating availability for ${coachId}`, error);
            this.handleError(error);
            return [];
        }
    }

    /**
     * Create a booking
     * Endpoint: POST /api/bookings?user_id=X (user_id required for service accounts)
     */
    async createBooking(bookingDetails: any): Promise<any> {
        try {
            await this.ensureAuthenticated();
            // Service accounts must specify user_id as query param
            const coachId = bookingDetails.coach_id;
            const response = await firstValueFrom(
                this.httpService.post(
                    `${this.baseUrl}/api/bookings`,
                    bookingDetails,
                    { params: { user_id: coachId } }
                )
            );
            this.logger.debug(`[createBooking] Created booking for coach ${coachId}`);
            return response.data;
        } catch (error) {
            this.logger.error(`[createBooking] Error creating booking`, error);
            this.handleError(error);
        }
    }

    async getAssignedPlayers(coachId: string): Promise<any[]> {
        try {
            await this.ensureAuthenticated();
            // Pass user_id to filter players for this specific coach context
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/api/coach/students`, {
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

    async findPlayerByEmail(coachId: string, senderString: string): Promise<any> {
        try {
            // Extract email from "Name <email>" format
            const emailMatch = senderString.match(/<([^>]+)>/);
            const email = emailMatch ? emailMatch[1] : senderString;
            this.logger.debug(`[findPlayerByEmail] Extracted email: ${email} from: ${senderString}`);
            
            const players = await this.getAssignedPlayers(coachId);
            this.logger.debug(`[findPlayerByEmail] Coach ${coachId} has ${players.length} assigned players`);
            
            const player = players.find(p => p.email?.toLowerCase() === email.toLowerCase());
            if (player) {
                this.logger.log(`[findPlayerByEmail] Found player: ${player._id || player.id} for email ${email}`);
            } else {
                this.logger.log(`[findPlayerByEmail] No player found for email ${email}`);
            }
            return player || null;
        } catch (error) {
            this.logger.warn(`Failed to find player by email ${senderString} for coach ${coachId}`, error);
            return null;
        }
    }

    /**
     * Look up a player globally by email (independent of coach assignment).
     * Uses /api/users/_?email=X to check if a user exists in the system.
     * @returns Player object if exists, null if not found
     */
    async lookupPlayerByEmail(senderString: string): Promise<any> {
        try {
            // Extract email from "Name <email>" format
            const emailMatch = senderString.match(/<([^>]+)>/);
            const email = emailMatch ? emailMatch[1] : senderString;
            this.logger.debug(`[lookupPlayerByEmail] Looking up global player for email: ${email}`);
            
            await this.ensureAuthenticated();
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/api/users/_`, {
                    params: { email }
                })
            );
            
            if (response.data) {
                this.logger.log(`[lookupPlayerByEmail] Found player in system: ${response.data._id || response.data.id}`);
                return response.data;
            }
            return null;
        } catch (error: any) {
            // 404 means user not found - this is expected, not an error
            if (error.response?.status === 404) {
                this.logger.log(`[lookupPlayerByEmail] No player found in system for email: ${senderString}`);
                return null;
            }
            this.logger.warn(`Failed to lookup player by email ${senderString}`, error);
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
