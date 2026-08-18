import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module.js';
import { MediaModule } from './media/media.module.js';
import { PagesModule } from './pages/pages.module.js';
import { PublicPagesModule } from './public-pages/public-pages.module.js';

@Module({
  imports: [AuthModule, PagesModule, PublicPagesModule, MediaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
