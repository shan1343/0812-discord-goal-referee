import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// The Discord bot is a package inside the main repository, so it deliberately
// shares the repository-level secret configuration with the FastAPI service.
dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });
