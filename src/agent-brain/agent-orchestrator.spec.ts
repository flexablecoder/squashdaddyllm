
import { Test, TestingModule } from '@nestjs/testing';
import { AgentOrchestrator } from './agent-orchestrator.service';
import { PythonApiAdapter } from '../core/adapters/python-api.adapter';
import { GmailService } from '../connectors/gmail/gmail.service';
import { GeminiService } from './gemini.service';

describe('AgentOrchestrator', () => {
    let orchestrator: AgentOrchestrator;
    let pythonAdapter: any;
    let gmailService: any;
    let geminiService: any;

    const mockCoachId = 'coach_123';
    const mockSender = 'player@test.com';
    const mockToken = 'refresh_token';

    beforeEach(async () => {
        pythonAdapter = {
            getPlayerSchedule: jest.fn(),
            findAvailability: jest.fn(),
            createBooking: jest.fn(),
        };
        gmailService = {
            sendReply: jest.fn(),
        };
        geminiService = {
            analyzeEmail: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AgentOrchestrator,
                { provide: PythonApiAdapter, useValue: pythonAdapter },
                { provide: GmailService, useValue: gmailService },
                { provide: GeminiService, useValue: geminiService },
            ],
        }).compile();

        orchestrator = module.get<AgentOrchestrator>(AgentOrchestrator);
    });

    // Use Case 1: Happy Path - Check Schedule
    it('CHECK_SCHEDULE: should reply with schedule when sessions exist', async () => {
        geminiService.analyzeEmail.mockResolvedValue({
            intent: 'CHECK_SCHEDULE',
            requests: [],
            confidence: 0.95
        });
        pythonAdapter.getPlayerSchedule.mockResolvedValue([
            { date: '2025-01-01', time: '10:00', coach: 'Coach Nick' }
        ]);

        await orchestrator.processEmailIntent(mockCoachId, 'Msg Body', mockSender, 'Subject', mockToken);

        expect(pythonAdapter.getPlayerSchedule).toHaveBeenCalledWith(mockSender);
        expect(gmailService.sendReply).toHaveBeenCalledWith(
            mockToken,
            expect.any(String),
            expect.stringContaining('2025-01-01 at 10:00')
        );
    });

    // Use Case 2: Happy Path - Book Lesson (Available)
    it('BOOK_LESSON: should book slot if available', async () => {
        geminiService.analyzeEmail.mockResolvedValue({
            intent: 'BOOK_LESSON',
            requests: [{ intent: 'BOOK_LESSON', date: '2025-01-02', time: '11:00' }],
            confidence: 0.9
        });
        pythonAdapter.findAvailability.mockResolvedValue([
            { start_time: '11:00', is_available: true }
        ]);

        await orchestrator.processEmailIntent(mockCoachId, 'Book me', mockSender, 'Subject', mockToken);

        expect(pythonAdapter.findAvailability).toHaveBeenCalledWith(mockCoachId, '2025-01-02');
        expect(pythonAdapter.createBooking).toHaveBeenCalledWith(expect.objectContaining({
            booking_date: '2025-01-02',
            start_time: '11:00'
        }));
        expect(gmailService.sendReply).toHaveBeenCalledWith(
            mockToken,
            expect.any(String),
            expect.stringContaining('Confirmed booking')
        );
    });

    // Use Case 3: Edge Case - Book Lesson (Unavailable)
    it('BOOK_LESSON: should suggest alternatives if slot is busy', async () => {
        geminiService.analyzeEmail.mockResolvedValue({
            intent: 'BOOK_LESSON',
            requests: [{ intent: 'BOOK_LESSON', date: '2025-01-03', time: '14:00' }],
            confidence: 0.9
        });
        // 14:00 missing/false, 15:00 and 16:00 available
        pythonAdapter.findAvailability.mockResolvedValue([
            { start_time: '15:00', is_available: true },
            { start_time: '16:00', is_available: true }
        ]);

        await orchestrator.processEmailIntent(mockCoachId, 'Book 2pm', mockSender, 'Subject', mockToken);

        expect(pythonAdapter.createBooking).not.toHaveBeenCalled();
        expect(gmailService.sendReply).toHaveBeenCalledWith(
            mockToken,
            expect.any(String),
            expect.stringContaining('Sorry')
        );
        expect(gmailService.sendReply).toHaveBeenCalledWith(
            mockToken,
            expect.any(String),
            expect.stringContaining('15:00 or 16:00')
        );
    });
});
