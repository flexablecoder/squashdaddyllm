
import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { PythonApiAdapter } from './adapters/python-api.adapter';

@Global()
@Module({
    imports: [HttpModule, ConfigModule],
    providers: [PythonApiAdapter],
    exports: [PythonApiAdapter],
})
export class CoreModule { }
