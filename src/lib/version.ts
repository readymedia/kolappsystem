import "server-only";
import pkg from "../../package.json";

/** Appens versjon (fra package.json) og byggets commit (satt av Vercel). Vises bare på /admin og /api/health. */
export const APP_VERSION: string = pkg.version;
export const APP_COMMIT: string = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "lokal";
