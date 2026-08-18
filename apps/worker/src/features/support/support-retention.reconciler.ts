import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { prisma } from "@real-estate/database";

/**
 * Erases anonymous support threads once their sliding window closes. Messages
 * cascade with the thread, so nothing survives for staff or in the database.
 *
 * Signed-in threads carry no `expiresAt` and are never swept: they belong to an
 * account and follow that account's own deletion rules.
 */
@Injectable()
export class SupportRetentionReconciler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SupportRetentionReconciler.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  onModuleInit(): void {
    void this.runOnce();
    // A minute of granularity is well inside the 30-minute retention promise.
    this.timer = setInterval(() => void this.runOnce(), 60_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const result = await prisma.supportThread.deleteMany({
        where: { userId: null, expiresAt: { lt: new Date() } },
      });
      if (result.count > 0) {
        this.logger.log(`Erased ${result.count} expired support thread(s)`);
      }
    } catch (error) {
      this.logger.error(`Support retention sweep failed: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
