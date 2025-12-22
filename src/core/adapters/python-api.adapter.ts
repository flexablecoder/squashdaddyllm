
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { IBookingSystem } from '../interfaces/booking-system.interface';
import { AvailabilitySlot } from '../../common/dtos/availability.dto';

@Injectable()
export class PythonApiAdapter implements IBookingSystem {
    private baseUrl: string;
    private apiKey: string; // Or dynamic token per coach

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        this.baseUrl = this.configService.get<string>('PYTHON_API_URL', 'http://localhost:8000');
        // For now assuming a system-level admin token or similar is used, 
        // or we pass the token in method arguments. 
        // Simplified for adapter pattern demo.
    }

    async findAvailability(coachId: string, date: string): Promise<AvailabilitySlot[]> {
        try {
            // Calling the new endpoint or existing one
            // Since legacy API endpoint for availability check is POST /api/availability/check
            const response = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}/api/availability/check`, {
                    coach_id: coachId,
                    date: date,
                })
            );
            // Map legacy response to AvailabilitySlot[]
            // Assuming legacy returns { available: true/false } for now based on stub
            // Real implementation would parse the list
            return [];
        } catch (error) {
            this.handleError(error);
            return [];
        }
    }

    async createBooking(bookingDetails: any): Promise<any> {
        try {
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
            // In a real scenario, we'd need the Coach's Bearer token. 
            // This is a complexity: Agent needs to act AS the coach.
            // For now, assuming we use a system admin token or similar (refactor required later).
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/api/coaches/me/players`)
            );
            return response.data;
        } catch (error) {
            this.handleError(error);
            return [];
        }
    }

    async getEnabledCoaches(): Promise<any[]> {
        try {
            // Using admin endpoint to get all coaches with enabled agents
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/api/admin/agent/coaches`)
            );
            return response.data;
        } catch (error) {
            console.error('Failed to fetch enabled coaches', error);
            // Non-blocking failure, return empty list
            return [];
        }
    }

    async getPlayerSchedule(playerEmail: string): Promise<any[]> {
        // Mock implementation for MVP - finding bookings for player
        // Real impl would call GET /api/bookings?player_email=...
        return [
            { id: '1', date: '2025-12-25', time: '10:00', coach: 'Nick' }
        ];
    }

    async findPlayerByEmail(email: string): Promise<any> {
        // Mock implementation or call backend
        // GET /api/users?email=...
        return { id: 'player_123', email: email, name: 'Player One' };
    }

    async saveGmailIntegration(coachId: string, refreshToken: string): Promise<void> {
        try {
            await firstValueFrom(
                this.httpService.patch(`${this.baseUrl}/api/coaches/${coachId}/integrations`, {
                    gmail_refresh_token: refreshToken,
                })
            );
        } catch (error) {
            this.handleError(error);
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
