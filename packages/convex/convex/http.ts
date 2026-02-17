import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./betterAuth/auth";
import { usageInstall, usageReview } from "./usageHttp";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

http.route({
  path: "/api/v1/usage/install",
  method: "POST",
  handler: usageInstall
});

http.route({
  path: "/api/v1/usage/review",
  method: "POST",
  handler: usageReview
});

export default http;
