## Usage

```shell
pnpm i
npx tsx src/cli.ts --help
```

Basic Example:

```shell
# Generate a call graph using static analysis for calls from a class method
npx tsx ../my-project/src/MyClass.ts MyClass.doSomething \
  --tsconfig ../my-project/tsconfig.json \
  > MyClass-doSomething-call-graph.d2

# Create a svg from the d2 file
d2 MyClass-doSomething-call-graph.d2
```

Install d2 cli: https://d2lang.com/tour/install
