
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { ProducerService } from './producer.service';
import { EmailProcessor } from './email.processor';
import { GmailWatcherService } from './gmail-watcher.service';
import { GmailModule } from '../connectors/gmail/gmail.module';
import { CoreModule } from '../core/core.module';
import { AgentBrainModule } from '../agent-brain/agent-brain.module';

@Module({
    imports: [
        BullModule.registerQueue({
            name: 'email-processing',
        }),
        ConfigModule,
        GmailModule,
        CoreModule,
        AgentBrainModule
    ],
    providers: [ProducerService, EmailProcessor, GmailWatcherService],
    exports: [ProducerService],
})
export class GmailWatcherModule { }
