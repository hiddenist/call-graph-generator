import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { CallGraphGenerator } from "./CallGraphGenerator";

yargs(hideBin(process.argv))
  .command<{
    sourceFile: string;
    callTarget: string;
    tsconfig?: string;
    debug?: boolean;
  }>(
    "$0 <sourceFile> <callTarget>",
    "generate a call graph",
    (y) =>
      y
        .positional("sourceFile", {
          describe: "The source file containing your call target",
        })
        .positional("callTarget", {
          describe: "A class method or function name to graph",
        }),
    (argv) => {
      try {
        CallGraphGenerator.run({
          sourceFile: argv.sourceFile,
          callableExpressionName: argv.callTarget,
          tsConfigFilePath: argv.tsconfig,
          debug: argv.debug,
        });
        process.exit(0);
      } catch (e) {
        if (e instanceof Error) {
          console.error(e.message);
          if (argv.debug) {
            console.error(e.stack);
          }
        } else {
          console.error("An unexpected error occurred", e);
        }
        process.exit(1);
      }
    },
  )
  .option("tsconfig", {
    alias: "t",
    type: "string",
    description: "Path to your tsconfig file",
  })
  .option("debug", {
    type: "boolean",
    description: "Enable debug mode",
  })
  .parse();
