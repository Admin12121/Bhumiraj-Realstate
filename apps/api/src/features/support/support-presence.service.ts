import { Injectable } from "@nestjs/common";
import { createRedis } from "@real-estate/redis";
import { prisma } from "@real-estate/database";
import { apiEnv } from "../../bootstrap-env";

/**
 * Presence is deliberately not a database table: it is worthless a few seconds
 * after it is written, and a staff member who closes their laptop must stop
 * counting as present without anyone running a cleanup job.
 */
const VIEWER_TTL_SECONDS = 25;
const key = (threadId: string) => `support:viewers:${threadId}`;

@Injectable()
export class SupportPresenceService {
  private readonly redis = createRedis(apiEnv.REDIS_CACHE_URL, "cache");

  /**
   * Records that a staff member has the thread open. The score is the moment
   * they arrived, so the earliest arrival is the reply holder — that is what
   * stops two staff from answering the same visitor at once.
   */
  async join(threadId: string, staffId: string): Promise<void> {
    const now = Date.now();
    const set = key(threadId);
    // Only set the arrival time if they are not already present, otherwise a
    // heartbeat would keep pushing them to the back of the queue.
    const existing = await this.redis.zscore(set, staffId);
    if (existing === null) {
      await this.redis.zadd(set, String(now), staffId);
    }
    await this.redis.zremrangebyscore(
      set,
      "-inf",
      String(now - VIEWER_TTL_SECONDS * 1000),
    );
    await this.redis.expire(set, VIEWER_TTL_SECONDS * 4);
  }


  async leave(threadId: string, staffId: string): Promise<void> {
    await this.redis.zrem(key(threadId), staffId);
  }

  /**
   * Everyone with the thread open, oldest arrival first. The first entry holds
   * the reply lock; if they leave without replying it passes to the next.
   */
  async viewers(
    threadId: string,
    stale = VIEWER_TTL_SECONDS * 1000,
  ): Promise<{ id: string; name: string; image: string | null; holder: boolean }[]> {
    const set = key(threadId);
    await this.redis.zremrangebyscore(set, "-inf", String(Date.now() - stale * 4));
    const ids = await this.redis.zrange(set, "0", "-1");
    if (ids.length === 0) return [];

    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, image: true },
    });
    const byId = new Map(users.map((user) => [user.id, user]));

    return ids.flatMap((id, index) => {
      const user = byId.get(id);
      if (!user) return [];
      return [
        {
          id: user.id,
          name: user.name,
          image: user.image,
          holder: index === 0,
        },
      ];
    });
  }

}
