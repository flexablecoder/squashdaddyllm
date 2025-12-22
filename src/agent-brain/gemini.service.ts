
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

export interface AnalysisResult {
    intent: 'CHECK_SCHEDULE' | 'BOOK_LESSON' | 'MULTI_INTENT' | 'OTHER';
    requests: Array<{
        intent: 'CHECK_SCHEDULE' | 'BOOK_LESSON';
        date?: string;
        time?: string;
        duration?: string;
        notes?: string;
    }>;
    confidence: number;
}

@Injectable()
export class GeminiService {
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel;
    private readonly logger = new Logger(GeminiService.name);

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (!apiKey) {
            this.logger.warn('GEMINI_API_KEY not found in configuration');
        } else {
            this.genAI = new GoogleGenerativeAI(apiKey);
            // Model name is configurable via GEMINI_MODEL env var
            const modelName = this.configService.get<string>('GEMINI_MODEL', 'gemini-flash-latest');
            this.logger.log(`Initializing Gemini model: ${modelName}`);
            this.model = this.genAI.getGenerativeModel({ model: modelName });
        }
    }

    async analyzeEmail(subject: string, body: string, senderEmail: string): Promise<AnalysisResult> {
        if (!this.model) {
            this.logger.error('Gemini model not initialized');
            return { intent: 'OTHER', requests: [], confidence: 0 };
        }

        const prompt = `
        You are an AI Scheduling Assistant for a Squash Coach.
        Analyze this email from a player (${senderEmail}).
        
        STRICT INTENT FILTERING:
        - CHECK_SCHEDULE: Asking "When do we play?", "What is my schedule?", "Am I playing tomorrow?"
        - BOOK_LESSON: Asking "Can I book?", "Are you free on Tuesday?", "I want a lesson".
        - MULTI_INTENT: Both of the above.
        - OTHER: Billing questions, technique advice, small talk, spam. IGNORE these.

        Subject: ${subject}
        Body: ${body}

        Return JSON ONLY:
        {
            "intent": "CHECK_SCHEDULE" | "BOOK_LESSON" | "MULTI_INTENT" | "OTHER",
            "requests": [
                {
                    "intent": "CHECK_SCHEDULE" | "BOOK_LESSON",
                    "date": "YYYY-MM-DD" or "next Tuesday" (extract exactly as written or implied),
                    "time": "HH:MM" (extract exactly),
                    "duration": "30min" | "60min" (default to 60min if booking implied but not specified),
                    "notes": "Any specific context"
                }
            ],
            "confidence": 0.0 to 1.0
        }
        `;

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
            // Default to OTHER on error to avoid bad auto-replies
            return { intent: 'OTHER', requests: [], confidence: 0 };
        }
    }
}
