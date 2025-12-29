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
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        let connection: any = {
          host: configService.get<string>('REDIS_HOST') || 'localhost',
          port: configService.get<number>('REDIS_PORT') || 6379,
          password: configService.get<string>('REDIS_PASSWORD'),
        };

        if (redisUrl) {
          try {
            const parsedUrl = new URL(redisUrl);
            console.log('Parsing REDIS_URL. Protocol:', parsedUrl.protocol);
            connection = {
              host: parsedUrl.hostname,
              port: parseInt(parsedUrl.port),
              username: parsedUrl.username,
              password: parsedUrl.password,
            };
            if (parsedUrl.protocol === 'rediss:') {
              connection.tls = { rejectUnauthorized: false };
            }
          } catch (e) {
            console.error('Invalid REDIS_URL, falling back to individual params', e);
          }
        }

        console.log('Redis Connection Config:', {
          host: connection.host,
          port: connection.port,
          hasPassword: !!connection.password,
          tls: !!connection.tls
        });

        return {
          connection,
        };
      },
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
