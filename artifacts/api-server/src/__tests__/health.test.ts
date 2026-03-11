import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

let app: express.Express;

async function setupApp() {
  const { default: router } = await import("../routes/index.js");
  app = express();
  app.use(express.json());
  app.use("/api", router);
  return app;
}

describe("GET /api/healthz", () => {
  beforeEach(async () => {
    await setupApp();
  });

  it("returns ok status", async () => {
    const res = await request(app).get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
