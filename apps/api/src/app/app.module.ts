import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { FormsModule } from './forms/forms.module';
import { LegalDocumentsModule } from './legal-documents/legal-documents.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { MediaModule } from './media/media.module';
import { PagesModule } from './pages/pages.module';
import { PublicFormsModule } from './public-forms/public-forms.module';
import { PublicNewsletterModule } from './public-newsletter/public-newsletter.module';
import { PublicPagesModule } from './public-pages/public-pages.module';
import { PublicSiteLayoutSectionsModule } from './public-site-layout-sections/public-site-layout-sections.module';
import { SiteLayoutSectionsModule } from './site-layout-sections/site-layout-sections.module';
import { SitesModule } from './sites/sites.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
    DashboardModule,
    MaintenanceModule,
    PagesModule,
    LegalDocumentsModule,
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
