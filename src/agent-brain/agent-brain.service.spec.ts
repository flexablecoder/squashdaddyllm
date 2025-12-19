
import { Test, TestingModule } from '@nestjs/testing';
import { AgentBrainService } from './agent-brain.service';

describe('AgentBrainService', () => {
    let service: AgentBrainService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [AgentBrainService],
        }).compile();

        service = module.get<AgentBrainService>(AgentBrainService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should process intent', () => {
        const result = service.processIntent('test email');
        expect(result).toBe('intent_processed');
    });
});
