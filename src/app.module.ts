import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { BullModule } from '@nestjs/bullmq';
import { GmailWatcherModule } from './gmail-watcher/gmail-watcher.module';
import { BookingsModule } from './bookings/bookings.module';
import { AgentBrainModule } from './agent-brain/agent-brain.module';
import { CalendarSyncModule } from './calendar-sync/calendar-sync.module';
import { AuthModule } from './auth/auth.module';

import { AgentOrchestrator } from './agent-brain/agent-orchestrator.service';
import { PythonApiAdapter } from './core/adapters/python-api.adapter';
import { GmailService } from './connectors/gmail/gmail.service';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { CoachConfig, CoachConfigSchema } from './config/schemas/coach-config.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    HttpModule,
    MongooseModule.forFeature([{ name: CoachConfig.name, schema: CoachConfigSchema }]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST'),
          port: 6379,
        },
      }),
      inject: [ConfigService],
    }),
    GmailWatcherModule,
    BookingsModule,
    AgentBrainModule,
    CalendarSyncModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService, AgentOrchestrator, PythonApiAdapter, GmailService],
})
export class AppModule { }
