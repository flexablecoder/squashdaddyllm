
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { GmailWatcherService } from './gmail-watcher.service';

@Processor('email-processing')
export class EmailProcessor extends WorkerHost {
    constructor(private readonly watcherService: GmailWatcherService) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        switch (job.name) {
            case 'check-inbox':
                console.log('Checking Inbox...');
                await this.watcherService.checkAllInboxes();
                return { result: 'Checked' };
            default:
                console.warn(`Unknown job name: ${job.name}`);
        }
    }
}
