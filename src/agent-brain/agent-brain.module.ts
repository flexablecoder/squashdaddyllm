
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentBrainService } from './agent-brain.service';
import { AgentOrchestrator } from './agent-orchestrator.service';
import { GeminiService } from './gemini.service';
import { GmailModule } from '../connectors/gmail/gmail.module';
import { CoreModule } from '../core/core.module';

@Module({
    imports: [ConfigModule, GmailModule, CoreModule],
    providers: [AgentBrainService, GeminiService, AgentOrchestrator],
    exports: [AgentBrainService, GeminiService, AgentOrchestrator],
})
export class AgentBrainModule { }
