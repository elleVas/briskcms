import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PagesModule } from './pages/pages.module.js';

@Module({
  imports: [PagesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
