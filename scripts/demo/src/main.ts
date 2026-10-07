// pop-demo entry point: pnpm --filter @pop/demo run demo <command> …
import { main } from "./cli";

process.exitCode = await main(process.argv.slice(2));
