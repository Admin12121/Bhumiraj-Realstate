import { Module } from "@nestjs/common";
import { E2eFixturesController } from "./e2e-fixtures.controller";

@Module({ controllers: [E2eFixturesController] })
export class E2eFixturesModule {}
