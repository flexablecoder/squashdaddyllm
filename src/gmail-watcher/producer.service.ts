
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ProducerService implements OnModuleInit {
    constructor(
        @InjectQueue('email-processing') private emailQueue: Queue,
        private configService: ConfigService
    ) { }

    async onModuleInit() {
        // Remove existing repeatable jobs to avoid duplicates on restart during dev
        const repeatableJobs = await this.emailQueue.getRepeatableJobs();
        for (const job of repeatableJobs) {
            if (job.name === 'check-inbox') {
                await this.emailQueue.removeRepeatableByKey(job.key);
            }
        }

        const pollIntervalMs = this.configService.get<number>('GMAIL_POLL_INTERVAL_MS', 300000); // Default 5 mins
        console.log(`Scheduling Gmail polling every ${pollIntervalMs}ms`);

        await this.emailQueue.add(
            'check-inbox',
            {},
            {
                repeat: {
                    every: pollIntervalMs,
                },
                jobId: 'check-inbox-job', // Ensure uniqueness
            },
        );
        console.log('Scheduled check-inbox job');
    }
}
