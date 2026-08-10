import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";

const describeIntegration = process.env.DATABASE_URL ? describe : describe.skip;
describeIntegration("API integration", () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ bodyParser: false });
    await app.init();
  });
  afterAll(async () => app.close());

  it("exposes an anonymous health endpoint", async () => {
    await request(app.getHttpServer()).get("/api/v1/health").expect(200);
  });
  it("protects admin pagination", async () => {
    await request(app.getHttpServer()).get("/api/v1/admin/users?page=1&pageSize=25").expect((response) => {
      if (![401, 403].includes(response.status)) throw new Error(`Expected 401/403, received ${response.status}`);
    });
  });
  it("validates listing filters with Zod", async () => {
    await request(app.getHttpServer()).get("/api/v1/listings?limit=500").expect(400);
  });
});
