import tsm from "ts-morph";

function test() {
  // nothing
}

export class CallGraphGenerator {
  private project: tsm.Project;
  private debugEnabled: boolean = false;

  static run({
    tsConfigFilePath = "tsconfig.json",
    sourceFile,
    callableExpressionName: executionName,
    debug = false,
  }: RunArgs): void {
    const args = {
      tsConfigFilePath,
    };
    if (debug) {
      console.debug("Creating CallGraphGenerator instance", args);
    }
    const instance = new CallGraphGenerator(args);

    test();

    if (debug) {
      console.debug("Enabling debug mode on instance");
      instance.debugEnabled = true;
    }

    test();

    const source = instance.project.getSourceFileOrThrow(sourceFile);

    const executionSteps = instance.findDeclaration(source, executionName);
    const trace = instance.traceExecution(executionSteps);

    instance.writeTraceAsD2Graph(trace);

    if (debug) {
      console.debug("Run complete");
    }
  }

  private debug(...message: any[]): void;
  private debug(message: string | any[] | (() => any)): void {
    if (this.debugEnabled) {
      const unpackedMessage =
        typeof message === "function" ? message() : message;
      const output = Array.isArray(unpackedMessage)
        ? unpackedMessage
        : [unpackedMessage];
      console.debug(...output);
    }
  }

  private constructor({ tsConfigFilePath }: CallGraphGeneratorConstructorArgs) {
    this.project = new tsm.Project({
      tsConfigFilePath,
    });
  }

  private findDeclaration(
    sourceFile: tsm.SourceFile,
    targetName: string,
  ): tsm.MethodDeclaration | tsm.FunctionDeclaration {
    if (this.debugEnabled) {
      console.debug(`Finding statements for ${targetName} in ${sourceFile}`);
    }

    const [classOrFunctionName, methodName] = targetName.split(".");
    if (!classOrFunctionName) {
      throw new Error("Invalid target name");
    }

    const declaration = sourceFile.forEachDescendant((node) => {
      if (methodName && tsm.Node.isClassDeclaration(node)) {
        if (node.getName() === classOrFunctionName) {
          const method = node.getMethod(methodName);
          if (!method) {
            throw new Error(
              `Method ${methodName} not found in class ${classOrFunctionName}`,
            );
          }
          return method;
        }
      } else if (tsm.Node.isFunctionDeclaration(node)) {
        if (node.getName() === targetName) {
          return node;
        }
      }
    });

    if (!declaration) {
      throw new Error(
        `Declaration for ${targetName} not found in ${sourceFile}`,
      );
    }

    return declaration;
  }

  private traceExecution(declaration: Declaration) {
    const trace = new Map<Declaration, Set<Declaration>>();
    const traceStack = [declaration];
    for (let i = 0; i < traceStack.length; i++) {
      const currentDeclaration = traceStack[i];
      if (!currentDeclaration) {
        throw new Error("No current declaration");
      }

      const references = this.getCallReferences(currentDeclaration);
      trace.set(currentDeclaration, references);

      const nextDeclarations = Array.from(references).filter(
        (declaration) =>
          this.isLocalDeclaration(declaration) && !trace.has(declaration),
      );

      traceStack.push(...nextDeclarations);
    }
  }

  private isLocalDeclaration(declaration: Declaration): boolean {
    const sourceFile = declaration?.getSourceFile();

    if (!sourceFile) {
      this.debug("No source file found for declaration", declaration.getText());
      return false;
    }

    const isInNodeModules = sourceFile.isInNodeModules();

    return !isInNodeModules;
  }

  private getCallReferences(declaration: Declaration): Set<Declaration> {
    this.debug(() => [
      "Tracing execution for statements of ",
      CallGraphGenerator.getDeclarationName(declaration),
    ]);

    const callStatements = this.getCallStatements(declaration);

    // this.debug(() => ["Found calls", callStatements.map((c) => c.getText())]);

    return new Set(
      callStatements.flatMap((call) => {
        const result = this.getDefinition(call);
        if (!result) return [];
        return [result];
      }),
    );
  }

  private getCallStatements(node: tsm.Node): tsm.CallExpression[] {
    this.debug(() => ["Visiting node", node.getText()]);
    const calls = node.getDescendantsOfKind(tsm.SyntaxKind.CallExpression);

    const expressions = node.getDescendantsOfKind(
      tsm.SyntaxKind.ExpressionStatement,
    );

    return [
      ...calls,
      ...expressions.flatMap((child) => {
        return this.getCallStatements(child);
      }),
    ];
  }

  private getDefinition(call: tsm.CallExpression) {
    const identifier =
      call.getExpressionIfKind(tsm.SyntaxKind.Identifier) ??
      call
        .getExpressionIfKind(tsm.SyntaxKind.PropertyAccessExpression)
        ?.getLastChild();

    if (!identifier) {
      this.debug("No identifier found in call", call.getText());
      return null;
    }

    const definition = identifier.getDefinitionNodes()[0];

    if (!definition) {
      this.debug("No definition found for identifier", call.getText());
      return null;
    }

    if (
      !tsm.Node.isFunctionDeclaration(definition) &&
      !tsm.Node.isMethodDeclaration(definition)
    ) {
      this.debug(() => [
        " -> skipping",
        call.getExpression().getText(),
        "because kind is",
        definition.getKindName(),
      ]);
      return null;
    }

    return definition;
  }

  private static getDeclarationName(declaration: Declaration): string {
    if (tsm.Node.isMethodDeclaration(declaration)) {
      return `${declaration.getFirstAncestorByKind(tsm.SyntaxKind.ClassDeclaration)?.getName()}.${declaration.getName()}`;
    }
    return declaration.getName() ?? "anonymous";
  }

  private writeTraceAsD2Graph(trace: Trace): void {
    this.debug("Writing trace as D2 graph (unimplemented)", trace);

    if (!this.debugEnabled) throw new Error("Unimplemented");
  }
}

type Trace = Map<Declaration, Set<Declaration>>;
type Declaration = tsm.MethodDeclaration | tsm.FunctionDeclaration;

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
