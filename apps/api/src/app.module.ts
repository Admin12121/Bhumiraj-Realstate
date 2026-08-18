import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { auth } from "./auth";
import { HealthModule } from "./features/health/health.module";
import { ListingsModule } from "./features/listings/listings.module";
import { ProfilesModule } from "./features/profiles/profiles.module";
import { FavoritesModule } from "./features/favorites/favorites.module";
import { MediaModule } from "./features/media/media.module";
import { AuctionsModule } from "./features/auctions/auctions.module";
import { AdminModule } from "./features/admin/admin.module";
import { ListingPaymentsModule } from "./features/listing-payments/listing-payments.module";
import { SupportModule } from "./features/support/support.module";
import { AccountModule } from "./features/account/account.module";
import { SavedSearchesModule } from "./features/saved-searches/saved-searches.module";
import { InquiriesModule } from "./features/inquiries/inquiries.module";
import { ViewingsModule } from "./features/viewings/viewings.module";
import { MessagingModule } from "./features/messaging/messaging.module";
import { NotificationsModule } from "./features/notifications/notifications.module";
import { E2eFixturesModule } from "./features/e2e-fixtures/e2e-fixtures.module";
import { ApiExceptionFilter } from "./shared/http/api-exception.filter";
import { CsrfOriginGuard } from "./shared/http/csrf-origin.guard";
import { RequestContextMiddleware } from "./shared/http/request-context.middleware";
import { apiEnv } from "./bootstrap-env";
import { AccessControlModule } from "./shared/auth/access-control.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [".env", "../../.env"] }),
    LoggerModule.forRoot({ pinoHttp: { level: apiEnv.NODE_ENV === "production" ? "info" : "debug", redact: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie", "password", "token", "secret"] } }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    AuthModule.forRoot({ auth, bodyParser: { json: { limit: "2mb" }, urlencoded: { limit: "2mb", extended: true }, rawBody: true } }),
    AccessControlModule,
    HealthModule,
    ListingsModule,
    ProfilesModule,
    FavoritesModule,
    MediaModule,
    AuctionsModule,
    AdminModule,
    ListingPaymentsModule,
    SupportModule,
    AccountModule,
    SavedSearchesModule,
    InquiriesModule,
    ViewingsModule,
    MessagingModule,
    NotificationsModule,
    ...(apiEnv.E2E_MODE && apiEnv.NODE_ENV !== "production"
      ? [E2eFixturesModule]
      : []),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfOriginGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) { consumer.apply(RequestContextMiddleware).forRoutes("*"); }
}
