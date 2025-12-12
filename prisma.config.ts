import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  earlyAccess: true,
  schema: "packages/database/prisma/schema.prisma",
});
