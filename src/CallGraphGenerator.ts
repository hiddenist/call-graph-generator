import tsm from "ts-morph";

export class CallGraphGenerator {
  private project: tsm.Project;
  private debug: boolean = false;

  static run({
    tsConfigFilePath = "tsconfig.json",
    sourceFile,
    callableExpressionName: executionName,
    debug = false,
  }: RunArgs): void {
    const args = {
      tsConfigFilePath,
    }
    if (debug) {
      console.debug("Creating CallGraphGenerator instance", args);
    }
    const instance = new CallGraphGenerator(args);

    if (debug) {
      console.debug("Enabling debug mode on instance");
      instance.debug = true;
    }

    const source = instance.project.getSourceFileOrThrow(sourceFile);

    const executionSteps = instance.findStatementsByCallableName(
      source,
      executionName,
    );
    const trace = instance.traceExecution(executionSteps);

    instance.writeTraceAsD2Graph(trace);

    if (debug) {
      console.debug("Run complete");
    }
  }

  private constructor({ tsConfigFilePath }: CallGraphGeneratorConstructorArgs) {
    this.project = new tsm.Project({
      tsConfigFilePath,
    });
  }

  private findStatementsByCallableName(
    sourceFile: tsm.SourceFile,
    targetName: string,
  ): Statements {
    if (this.debug) {
      console.debug(`Finding statements for ${targetName} in ${sourceFile}`);
      return;
    }
    throw new Error("Unimplemented")
  }

  private traceExecution(statements: Statements): Trace {
    if (this.debug) {
      console.debug("Tracing execution for statements", statements);
      return;
    }
    throw new Error("Unimplemented")
  }

  private writeTraceAsD2Graph(trace: Trace): void {
    if (this.debug) {
      console.debug("Writing trace as D2 graph", trace);
      return;
    }
    throw new Error("Unimplemented")
  }
}

type Trace = unknown;
type Statements = unknown;

export interface RunArgs {
  /**
   * The source file where the callable expression is defined.
   */
  sourceFile: string;
  /**
   * The name of the function or class method to trace.
   *
   * Class methods are specified in a dot format, e.g. `ClassName.methodName`.
   */
  callableExpressionName: string;
  /**
   * Optional override for the TypeScript config file path.
   *
   * @default "tsconfig.json"
   */
  tsConfigFilePath?: string;
  /**
   * Enables debug mode.
   */
  debug?: boolean;
}

export interface CallGraphGeneratorConstructorArgs {
  tsConfigFilePath: string;
}
