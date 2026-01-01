import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

export interface AnalysisResult {
    intent: 'CHECK_SCHEDULE' | 'BOOK_LESSON' | 'RESCHEDULE' | 'SIGNUP_CLINIC' | 'SIGNUP_TOURNAMENT' | 'MULTI_INTENT' | 'OTHER';
    skills_identified: string[];
    requests: Array<{
        intent: string;
        date?: string;
        time?: string;
        time_range_start?: string;
        time_range_end?: string;
        duration?: string;
        notes?: string;
    }>;
    email_draft?: {
        type: 'CLARIFICATION_NEEDED' | 'HANDLED' | 'OTHER';
        subject: string;
        body: string;
    };
    confidence: number;
}

@Injectable()
export class GeminiService {
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel;
    private readonly logger = new Logger(GeminiService.name);
    private skillsIndex: string = '';

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (!apiKey) {
            this.logger.warn('GEMINI_API_KEY not found in configuration');
        } else {
            this.genAI = new GoogleGenerativeAI(apiKey);
            // Model name is configurable via GEMINI_MODEL env var
            const modelName = this.configService.get<string>('GEMINI_MODEL', 'gemini-1.5-flash'); // Default to flash for speed/cost
            this.logger.log(`Initializing Gemini model: ${modelName}`);
            this.model = this.genAI.getGenerativeModel({ model: modelName });

            this.loadSkillsIndex();
        }
    }

    private loadSkillsIndex() {
        try {
            // Assuming skills are in project_root/skills relative to dist/src/agent-brain
            // Development path: c:\web\squashdaddy\agent-service\skills\index.md
            // We need to resolve this relative to the process cwd usually
            const skillsPath = path.resolve(process.cwd(), 'skills/index.md');
            if (fs.existsSync(skillsPath)) {
                this.skillsIndex = fs.readFileSync(skillsPath, 'utf-8');
                this.logger.log('Skills index loaded successfully');
            } else {
                this.logger.warn(`Skills index not found at ${skillsPath}`);
                this.skillsIndex = 'No skills available.';
            }
        } catch (error) {
            this.logger.error('Failed to load skills index', error);
            this.skillsIndex = 'Error loading skills.';
        }
    }

    async analyzeEmail(subject: string, body: string, senderEmail: string, coachId: string, playerId?: string): Promise<AnalysisResult> {
        if (!this.model) {
            this.logger.error('Gemini model not initialized');
            return { intent: 'OTHER', skills_identified: [], requests: [], confidence: 0 };
        }

        this.logger.debug(`[Generic Analysis Input] Sender: ${senderEmail}, Subject: ${subject}, CoachId: ${coachId}, PlayerId: ${playerId}`);
        this.logger.debug(`[Generic Analysis Body] ${body}`);

        const currentDate = new Date().toDateString();

        const prompt = `
        You are an AI Scheduling Assistant for a Squash Coach (SquashDaddy).
        Your goal is to parse player emails and map them to available Agent Skills.

        AVAILABLE SKILLS:
        ${this.skillsIndex}

        CONTEXT:
        Current Date: ${currentDate}
        Coach ID: ${coachId}
        Player ID: ${playerId || 'Unknown/New Player'}

        Analyze this email from a player (${senderEmail}).

        GOALS:
        1. Identify the Intent(s).
        2. Map to specific Skill IDs (folder names from the index, e.g., 'schedule-training').
        3. Extract Entities (Date, Time, Duration).
        4. Draft a Response Email:
           - If information is missing (e.g., "Book a lesson" but no time): Draft a 'CLARIFICATION_NEEDED' email politely asking for details.
           - If the request is clear and actionable: Draft a 'HANDLED' email confirming we are processing it (don't promise it's done, just that the agent is working on it).
           
        STRICT INTENT MAPPING:
        - CHECK_SCHEDULE -> schedule-information
        - BOOK_LESSON -> schedule-training
        - RESCHEDULE -> reschedule-training
        - SIGNUP_CLINIC -> signup-clinic
        - SIGNUP_TOURNAMENT -> signup-tournament
        - OTHER -> No skill

        TIME PARSING RULES:
        - If the user specifies a precise time (e.g., "3pm"), use the "time" field (e.g., "15:00").
        - If the user specifies a vague time (e.g., "morning", "afternoon") OR implies flexibility, use "time_range_start" and "time_range_end".
        - Standard Ranges:
          - Morning: "06:00" to "12:00"
          - Afternoon: "12:00" to "17:00"
          - Evening: "17:00" to "22:00"
        - INTELLIGENT FLEXIBILITY: If the user indicates a preference (e.g., "morning") but seems flexible (e.g., "or whenever is free"), output a WIDER range or NO range (empty string) to search the whole day.

        DATE PARSING RULES:
        - Use "Current Date" from CONTEXT to calculate specific dates from relative terms (e.g. "Friday", "Tomorrow").
        - Always format date as "YYYY-MM-DD".

        Subject: ${subject}
        Body: ${body}

        Return JSON ONLY:
        {
            "intent": "CHECK_SCHEDULE" | "BOOK_LESSON" | "RESCHEDULE" | "SIGNUP_CLINIC" | "SIGNUP_TOURNAMENT" | "MULTI_INTENT" | "OTHER",
            "skills_identified": ["skill-name", ...],
            "requests": [
                {
                    "intent": "intent_name",
                    "date": "YYYY-MM-DD" or "next Tuesday" (extract exactly as written or implied),
                    "time": "HH:MM" (Start time if precise),
                    "time_range_start": "HH:MM",
                    "time_range_end": "HH:MM",
                    "duration": "30min" | "60min" (default to 60min if booking implied but not specified),
                    "notes": "Any specific context"
                }
            ],
            "email_draft": {
                "type": "CLARIFICATION_NEEDED" | "HANDLED" | "OTHER",
                "subject": "Re: ${subject}",
                "body": "The plain text email body..."
            },
            "confidence": 0.0 to 1.0
        }
        `;

        this.logger.debug(`[Gemini Prompt] ${prompt}`);

        try {
            const result = await this.model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: 'application/json' }
            });

            const responseText = result.response.text();
            this.logger.debug(`Gemini Response: ${responseText}`);
            return JSON.parse(responseText) as AnalysisResult;
        } catch (error) {
            this.logger.error('Error analyzing email with Gemini', error);
            // Default to OTHER on error
            return { intent: 'OTHER', skills_identified: [], requests: [], confidence: 0 };
        }
    }
}
