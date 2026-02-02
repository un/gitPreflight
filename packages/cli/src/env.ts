import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export type ShipstampEnv = {
  SHIPSTAMP_API_BASE_URL: string;
};

export function getShipstampEnv(rawEnv: NodeJS.ProcessEnv = process.env): ShipstampEnv {
  const env = createEnv({
    server: {
      SHIPSTAMP_API_BASE_URL: z.string().url()
    },
    runtimeEnv: rawEnv,
    onValidationError: () => {
      throw new Error("Invalid environment variables");
    }
  });

  return {
    SHIPSTAMP_API_BASE_URL: env.SHIPSTAMP_API_BASE_URL
  };
}
