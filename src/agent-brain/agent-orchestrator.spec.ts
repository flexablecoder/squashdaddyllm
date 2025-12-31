
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
            findPlayerByEmail: jest.fn(),
        };
        gmailService = {
            sendReply: jest.fn(),
            createDraft: jest.fn(),
            addLabels: jest.fn(),
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
    it('CHECK_SCHEDULE: should reply and tag SQD Handled', async () => {
        geminiService.analyzeEmail.mockResolvedValue({
            intent: 'CHECK_SCHEDULE',
            requests: [],
            skills_identified: ['schedule-information'],
            confidence: 0.95
        });
        pythonAdapter.getPlayerSchedule.mockResolvedValue([
            { date: '2025-01-01', time: '10:00', coach: 'Coach Nick' }
        ]);
        pythonAdapter.findPlayerByEmail.mockResolvedValue({ id: 'player_123', email: mockSender });

        await orchestrator.processEmailIntent(mockCoachId, 'Msg Body', mockSender, 'Subject', mockToken, 'thread-123', 'send_full_replies', null);

        expect(pythonAdapter.findPlayerByEmail).toHaveBeenCalledWith(mockCoachId, mockSender);
        expect(geminiService.analyzeEmail).toHaveBeenCalledWith('Subject', 'Msg Body', mockSender, mockCoachId, 'player_123');
        expect(gmailService.sendReply).toHaveBeenCalledWith(
            mockToken,
            'thread-123',
            expect.stringContaining('2025-01-01 at 10:00'),
            mockSender,
            'Subject'
        );
        expect(gmailService.addLabels).toHaveBeenCalledWith(mockToken, 'thread-123', ['SQD Handled', 'sqd-read'], undefined, undefined);
    });

    // Use Case 2: Happy Path - Book Lesson (Available)
    it('BOOK_LESSON: should book, reply, and tag SQD Handled', async () => {
        geminiService.analyzeEmail.mockResolvedValue({
            intent: 'BOOK_LESSON',
            requests: [{ intent: 'BOOK_LESSON', date: '2025-01-02', time: '11:00' }],
            skills_identified: ['schedule-training'],
            confidence: 0.9
        });
        pythonAdapter.findAvailability.mockResolvedValue([
            { start_time: '11:00', is_available: true }
        ]);
        pythonAdapter.findPlayerByEmail.mockResolvedValue(null); // No player found case

        await orchestrator.processEmailIntent(mockCoachId, 'Book me', mockSender, 'Subject', mockToken, 'thread-123', 'send_full_replies', null);
        
        expect(geminiService.analyzeEmail).toHaveBeenCalledWith('Subject', 'Book me', mockSender, mockCoachId, undefined);

        expect(pythonAdapter.createBooking).toHaveBeenCalledWith(expect.objectContaining({
            booking_date: '2025-01-02',
            start_time: '11:00'
        }));
        expect(gmailService.sendReply).toHaveBeenCalledWith(
            mockToken,
            'thread-123',
            expect.stringContaining('Confirmed booking'),
            mockSender,
            'Subject'
        );
        expect(gmailService.addLabels).toHaveBeenCalledWith(mockToken, 'thread-123', ['SQD Handled', 'sqd-read'], undefined, undefined);
    });

    // Use Case 3: Edge Case - Book Lesson (Unavailable)
    it('BOOK_LESSON: should draft reply and tag SQD review pending if busy', async () => {
        geminiService.analyzeEmail.mockResolvedValue({
            intent: 'BOOK_LESSON',
            requests: [{ intent: 'BOOK_LESSON', date: '2025-01-03', time: '14:00' }],
            skills_identified: ['schedule-training'],
            confidence: 0.9
        });
        // 14:00 unavailable
        pythonAdapter.findAvailability.mockResolvedValue([
            { start_time: '14:00', is_available: false },
            { start_time: '15:00', is_available: true }
        ]);

        await orchestrator.processEmailIntent(mockCoachId, 'Book 2pm', mockSender, 'Subject', mockToken, 'thread-123', 'draft_only', null);

        expect(pythonAdapter.findAvailability).toHaveBeenCalled();

        expect(pythonAdapter.createBooking).not.toHaveBeenCalled();
        expect(gmailService.sendReply).not.toHaveBeenCalled();
        // Should create DRAFT
        expect(gmailService.createDraft).toHaveBeenCalledWith(
            mockToken,
            'thread-123',
            expect.stringContaining('Sorry'),
            mockSender,
            'Subject'
        );
        expect(gmailService.addLabels).toHaveBeenCalledWith(mockToken, 'thread-123', ['SQD review pending', 'sqd-read'], undefined, undefined);
        
        // Verify injection identity
        expect((gmailService as any)._marker).toBe('Injected');
    });

    // Use Case 4: Ignore OTHER
    it('OTHER: should ignore and do nothing (leave unread)', async () => {
        geminiService.analyzeEmail.mockResolvedValue({ intent: 'OTHER', skills_identified: [], requests: [], confidence: 0 });

        await orchestrator.processEmailIntent(mockCoachId, 'Hi', mockSender, 'Subject', mockToken, 'thread-123', 'send_full_replies', null);

        expect(gmailService.sendReply).not.toHaveBeenCalled();
        expect(gmailService.createDraft).not.toHaveBeenCalled();
        expect(gmailService.addLabels).toHaveBeenCalledWith(mockToken, 'thread-123', ['sqd-read'], undefined, undefined);
    });
});
