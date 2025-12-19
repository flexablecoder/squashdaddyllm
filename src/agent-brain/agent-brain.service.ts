
import { Injectable } from '@nestjs/common';

@Injectable()
export class AgentBrainService {
    processIntent(emailContent: string): string {
        return 'intent_processed';
    }
}
