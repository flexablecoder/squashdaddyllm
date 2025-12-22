import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { GoogleAuthService } from './google-auth.service';
import { GoogleAuthController } from './google-auth.controller';
import { PythonApiAdapter } from '../core/adapters/python-api.adapter';

@Module({
    imports: [ConfigModule, HttpModule],
    providers: [GoogleAuthService, PythonApiAdapter],
    controllers: [GoogleAuthController],
    exports: [GoogleAuthService],
})
export class AuthModule { }
