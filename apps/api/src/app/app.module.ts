import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module.js';
import { PagesModule } from './pages/pages.module.js';

@Module({
  imports: [AuthModule, PagesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
