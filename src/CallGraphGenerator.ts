import tsm, { DefaultClause } from "ts-morph";

export class CallGraphGenerator {
  private project: tsm.Project;
  private debugEnabled: boolean = false;

  static run({
    tsConfigFilePath = "tsconfig.json",
    sourceFile,
    callableExpressionName: executionName,
    debug = false,
    omitFileNames = false,
    ignorePackages = [],
  }: RunArgs): void {
    const args = {
      tsConfigFilePath,
    };
    if (debug) {
      console.error("Creating CallGraphGenerator instance", args);
    }
    const instance = new CallGraphGenerator(args);

    if (debug) {
      console.error("Enabling debug mode on instance");
      instance.debugEnabled = true;
    }

    const source = instance.project.getSourceFileOrThrow(sourceFile);

    const declaration = instance.findDeclaration(source, executionName);
    const trace = instance.traceExecution(declaration);

    instance.writeTraceAsD2Graph(source, declaration, trace, {
      omitFileNames,
      ignorePackages
    });

    if (debug) {
      console.error("Run complete");
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
      console.error(...output);
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
      console.error(`Finding statements for ${targetName} in ${sourceFile}`);
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

  private traceExecution(declaration: Declaration): Trace {
    const trace = new Map<Declaration, Set<Declaration>>();
    const traceStack = [declaration];
    for (let i = 0; i < traceStack.length; i++) {
      const currentDeclaration = traceStack[i];
      if (!currentDeclaration) {
        throw new Error("No current declaration");
      }

      const references = this.getChildDeclarations(currentDeclaration);
      trace.set(currentDeclaration, references);

      const nextDeclarations = Array.from(references).filter(
        (declaration) =>
          this.isLocalDeclaration(declaration) && !trace.has(declaration),
      );

      traceStack.push(...nextDeclarations);
    }

    return trace;
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

  private getChildDeclarations(declaration: Declaration): Set<Declaration> {
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

  private writeTraceAsD2Graph(
    source: tsm.SourceFile,
    rootDeclaration: Declaration,
    trace: Trace,
    options: { omitFileNames?: boolean, ignorePackages?: string[] } = {},
  ): void {
    const ignore = new Set(options.ignorePackages);

    const getDeclarationFileOrPackageIdentifier = (
      sourceFile: tsm.SourceFile,
    ) => {
      if (sourceFile.isInNodeModules()) {
        const parts = sourceFile.getFilePath().split("node_modules");
        const packageName =
          parts.pop()?.match(/\/(?<packageName>(@[^\/]+\/)?([^\/]+))\//)?.groups
            ?.packageName ?? `Unknown Package`;
        if (ignore.has(packageName)) {
          return null;
        }
        return `node_modules."${packageName}".`;
      }

      if (options.omitFileNames) {
        return "";
      }

      if (sourceFile === source) {
        return `"Current File".`;
      }

      const relativePath =
        source.getRelativePathAsModuleSpecifierTo(sourceFile) +
        `.${sourceFile.getExtension()}`;
      return `"${relativePath}".`;
    };

    const getD2Identifier = (declaration: Declaration) => {
      const declarationName =
        CallGraphGenerator.getDeclarationName(declaration);

      const declarationSource = declaration.getSourceFile();
      const packageOrFile = getDeclarationFileOrPackageIdentifier(declarationSource)

      if (packageOrFile == null){
        return null;
      }

      return `${packageOrFile}${declarationName
        .split(".")
        .reverse()
        .map((part, idx) => (idx === 0 ? `"${part}()"` : `"${part}"`))
        .reverse()
        .join(".")}`;
    };
    const rootDeclarationId = getD2Identifier(rootDeclaration) ?? "root";

    const rootIdentifier =
      getDeclarationFileOrPackageIdentifier(source) ||
      rootDeclarationId.split(".")[0];

    console.log("direction: down");
    console.log(`${rootIdentifier}: { near: top-center }`);
    // if (rootDeclarationId !== rootIdentifier) {
    //   console.log(`${rootDeclarationId}: { near: top-center }`);
    // }
    console.log(`${rootDeclarationId}.style.fill: "#a3ffd7"`);
    console.log(`node_modules.style.fill: "#FFFFFF"`);
    console.log(`node_modules: { near: bottom-center }`);

    trace.forEach((references, declaration) => {
      const declarationIdentifier = getD2Identifier(declaration);
      if (!declarationIdentifier) {
        return;
      }

      references.forEach((reference) => {
        const referenceIdentifier = getD2Identifier(reference);
        if (!referenceIdentifier) {
          return;
        }
        console.log(
          `${declarationIdentifier} -> ${referenceIdentifier}`,
        );
      });
    });
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
  /**
   * Omit file names from the output.
   */
  omitFileNames?: boolean;
  /**
   * Packages from node modules that should be ignored.
   */
  ignorePackages?: string[];
}

export interface CallGraphGeneratorConstructorArgs {
  tsConfigFilePath: string;
}
