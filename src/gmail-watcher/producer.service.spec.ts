
import { Test, TestingModule } from '@nestjs/testing';
import { ProducerService } from './producer.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('ProducerService', () => {
    let service: ProducerService;
    const mockQueue = {
        add: jest.fn(),
        getRepeatableJobs: jest.fn().mockReturnValue([]),
        removeRepeatableByKey: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ProducerService,
                {
                    provide: getQueueToken('email-processing'),
                    useValue: mockQueue,
                },
            ],
        }).compile();

        service = module.get<ProducerService>(ProducerService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should schedule check-inbox job on init', async () => {
        await service.onModuleInit();
        expect(mockQueue.add).toHaveBeenCalledWith(
            'check-inbox',
            {},
            expect.objectContaining({
                repeat: expect.objectContaining({ pattern: '*/2 * * * *' }),
            }),
        );
    });
});
