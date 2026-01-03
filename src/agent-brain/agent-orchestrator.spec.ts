
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
            lookupPlayerByEmail: jest.fn(), // Global player lookup
            getCoachEmail: jest.fn(),
            logEmail: jest.fn(),
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
        pythonAdapter.lookupPlayerByEmail.mockResolvedValue({ id: 'player_123', email: mockSender }); // Global
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
        expect(gmailService.addLabels).toHaveBeenCalledWith(mockToken, 'thread-123', expect.arrayContaining(['SQD Handled', 'sqd-read']), undefined, undefined);
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
        pythonAdapter.lookupPlayerByEmail.mockResolvedValue({ id: 'player_123', email: mockSender }); // Global lookup
        pythonAdapter.findPlayerByEmail.mockResolvedValue({ id: 'player_123', email: mockSender }); // Coach connection

        await orchestrator.processEmailIntent(mockCoachId, 'Book me', mockSender, 'Subject', mockToken, 'thread-123', 'send_full_replies', null);
        
        expect(geminiService.analyzeEmail).toHaveBeenCalledWith('Subject', 'Book me', mockSender, mockCoachId, 'player_123');

        expect(pythonAdapter.createBooking).toHaveBeenCalledWith(expect.objectContaining({
            booking_date: '2025-01-02',
            start_time: '11:00'
        }));
        expect(gmailService.sendReply).toHaveBeenCalledWith(
            mockToken,
            'thread-123',
            expect.stringContaining('I have created a booking for 2025-01-02 at 11:00'),
            mockSender,
            'Subject'
        );
        expect(gmailService.addLabels).toHaveBeenCalledWith(mockToken, 'thread-123', expect.arrayContaining(['SQD Handled', 'sqd-read']), undefined, undefined);
    });

    // Use Case 3: Edge Case - Book Lesson (Unavailable)
    it('BOOK_LESSON: should draft reply and tag SQD review pending if busy', async () => {
        geminiService.analyzeEmail.mockResolvedValue({
            intent: 'BOOK_LESSON',
            requests: [{ intent: 'BOOK_LESSON', date: '2025-01-03', time: '14:00' }],
            skills_identified: ['schedule-training'],
            confidence: 0.9
        });
        // ALL slots unavailable (to test failure/suggestion path)
        pythonAdapter.findAvailability.mockResolvedValue([
            { start_time: '14:00', is_available: false },
            { start_time: '15:00', is_available: false }
        ]);
        pythonAdapter.lookupPlayerByEmail.mockResolvedValue({ id: 'player_123', email: mockSender }); // Global lookup
        pythonAdapter.findPlayerByEmail.mockResolvedValue({ id: 'player_123', email: mockSender }); // Coach connection

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
        expect(gmailService.addLabels).toHaveBeenCalledWith(mockToken, 'thread-123', expect.arrayContaining(['SQD review pending', 'sqd-read']), undefined, undefined);
    });

    // Use Case 4: Ignore OTHER
    it('OTHER: should ignore and do nothing (leave unread)', async () => {
        geminiService.analyzeEmail.mockResolvedValue({ intent: 'OTHER', skills_identified: [], requests: [], confidence: 0 });

        await orchestrator.processEmailIntent(mockCoachId, 'Hi', mockSender, 'Subject', mockToken, 'thread-123', 'send_full_replies', null);

        expect(gmailService.sendReply).not.toHaveBeenCalled();
        expect(gmailService.createDraft).not.toHaveBeenCalled();
        expect(gmailService.addLabels).toHaveBeenCalledWith(mockToken, 'thread-123', ['sqd-read'], undefined, undefined);
    });

    describe('Functional Scheduling Scenarios', () => {
        // Scenario 1: "Friday Morning" Request (Unavailable) -> Expect Booking at 15:00
        // User Expectation: System schedules for 3pm (First available slot on valid day) despite morning preference failing.
        it('should book first available afternoon slot when morning is requested but unavailable', async () => {
            geminiService.analyzeEmail.mockResolvedValue({
                intent: 'BOOK_LESSON',
                requests: [{ 
                    intent: 'BOOK_LESSON', 
                    date: '2025-01-03', 
                    time_range_start: '06:00',
                    time_range_end: '18:00'
                }], // LLM interprets 'morning' + flexibility as 6am-6pm range
                skills_identified: ['schedule-training'],
                confidence: 0.95,
                email_draft: { body: 'Draft' }
            });
            
            // Coach available 15:00 - 18:00
            pythonAdapter.findAvailability.mockResolvedValue([
                { start_time: '15:00', is_available: true },
                { start_time: '16:00', is_available: true },
                { start_time: '17:00', is_available: true },
                { start_time: '18:00', is_available: true }
            ]);
            pythonAdapter.lookupPlayerByEmail.mockResolvedValue({ id: 'player_123', email: mockSender }); // Global
            pythonAdapter.findPlayerByEmail.mockResolvedValue({ id: 'player_123', email: mockSender }); // Connected
            pythonAdapter.createBooking.mockResolvedValue({ id: 'booking_123' });

            await orchestrator.processEmailIntent(mockCoachId, 'Msg', 'jhirschi@hotmail.com', 'can we book a lesson for friday', mockToken, 'thread-func-1', 'send_full_replies', null);

            // Expectation: Should book 15:00
            expect(pythonAdapter.createBooking).toHaveBeenCalledWith(expect.objectContaining({
                booking_date: '2025-01-03',
                start_time: '15:00'
            }));
            
            // Expect reply to mention booking
            // Expect reply to mention booking and alternatives
            expect(gmailService.sendReply).toHaveBeenCalledWith(
                mockToken, 'thread-func-1',
                expect.stringContaining('I have created a booking for 2025-01-03 at 15:00'),
                'jhirschi@hotmail.com', 'can we book a lesson for friday'
            );
            
            // Also expect it to mention other times
            expect(gmailService.sendReply).toHaveBeenCalledWith(
                mockToken, 'thread-func-1',
                expect.stringContaining('Alternative times available'),
                'jhirschi@hotmail.com', 'can we book a lesson for friday'
            );
        });

        // Scenario 2: Happy Path
        it('should book specific available slot', async () => {
            geminiService.analyzeEmail.mockResolvedValue({
                intent: 'BOOK_LESSON',
                requests: [{ intent: 'BOOK_LESSON', date: '2025-01-03', time: '16:00' }],
                skills_identified: ['schedule-training'],
                confidence: 0.95
            });
             pythonAdapter.findAvailability.mockResolvedValue([
                { start_time: '16:00', is_available: true }
            ]);
            pythonAdapter.lookupPlayerByEmail.mockResolvedValue({ id: 'player_123', email: mockSender }); // Global
            pythonAdapter.findPlayerByEmail.mockResolvedValue({ id: 'player_123', email: mockSender }); // Connected

            await orchestrator.processEmailIntent(mockCoachId, 'Msg', mockSender, 'Fri 4pm', mockToken, 'thread-func-2', 'send_full_replies', null);

            expect(pythonAdapter.createBooking).toHaveBeenCalledWith(expect.objectContaining({
                booking_date: '2025-01-03',
                start_time: '16:00'
            }));
        });

        // Scenario 3: Unknown player - should get registration email
        it('should suggest registration when player is unknown', async () => {
            geminiService.analyzeEmail.mockResolvedValue({
                intent: 'BOOK_LESSON',
                requests: [{ intent: 'BOOK_LESSON', date: '2025-01-04', time: '10:00' }],
                skills_identified: ['schedule-training'],
                confidence: 0.95
            });
            pythonAdapter.lookupPlayerByEmail.mockResolvedValue(null); // Unknown globally
            pythonAdapter.findPlayerByEmail.mockResolvedValue(null); 

            await orchestrator.processEmailIntent(mockCoachId, 'Msg', mockSender, 'Sat 10am', mockToken, 'thread-func-3', 'send_full_replies', null);

             expect(pythonAdapter.createBooking).not.toHaveBeenCalled();
             expect(gmailService.sendReply).toHaveBeenCalledWith(
                mockToken, 'thread-func-3',
                expect.stringContaining('register'), // Expect registration link
                 mockSender, 'Sat 10am'
            );
        });

        // Scenario 4: Player registered but not connected - should get connection pending email
        it('should suggest connection when player exists but is not connected', async () => {
            geminiService.analyzeEmail.mockResolvedValue({
                intent: 'BOOK_LESSON',
                requests: [{ intent: 'BOOK_LESSON', date: '2025-01-04', time: '10:00' }],
                skills_identified: ['schedule-training'],
                confidence: 0.95
            });
            pythonAdapter.lookupPlayerByEmail.mockResolvedValue({ id: 'player_123', email: mockSender }); // Exists globally
            pythonAdapter.findPlayerByEmail.mockResolvedValue(null); // Not connected to this coach

            await orchestrator.processEmailIntent(mockCoachId, 'Msg', mockSender, 'Sat 10am', mockToken, 'thread-func-4', 'send_full_replies', null);

             expect(pythonAdapter.createBooking).not.toHaveBeenCalled();
             expect(gmailService.sendReply).toHaveBeenCalledWith(
                mockToken, 'thread-func-4',
                expect.stringContaining('not yet connected'), // Expect connection pending message
                 mockSender, 'Sat 10am'
            );
        });
    });
});
