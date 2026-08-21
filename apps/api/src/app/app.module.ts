import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module.js';
import { FormsModule } from './forms/forms.module.js';
import { MediaModule } from './media/media.module.js';
import { PagesModule } from './pages/pages.module.js';
import { PublicFormsModule } from './public-forms/public-forms.module.js';
import { PublicNewsletterModule } from './public-newsletter/public-newsletter.module.js';
import { PublicPagesModule } from './public-pages/public-pages.module.js';
import { PublicSiteLayoutSectionsModule } from './public-site-layout-sections/public-site-layout-sections.module.js';
import { SiteLayoutSectionsModule } from './site-layout-sections/site-layout-sections.module.js';
import { SitesModule } from './sites/sites.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    AuthModule,
    PagesModule,
    PublicPagesModule,
    MediaModule,
    SitesModule,
    FormsModule,
    PublicFormsModule,
    PublicNewsletterModule,
    SiteLayoutSectionsModule,
    PublicSiteLayoutSectionsModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
