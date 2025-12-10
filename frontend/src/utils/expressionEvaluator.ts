import * as acorn from 'acorn';
import { z } from 'zod';

// --- 1. Typed AST for boolean expressions ---
type BooleanAST =
  | acorn.Node & { type: "Literal"; value: boolean }
  | acorn.Node & { type: "Identifier"; name: string }
  | acorn.Node & { type: "UnaryExpression"; operator: "!"; argument: BooleanAST }
  | acorn.Node & { type: "BinaryExpression" | "LogicalExpression"; left: BooleanAST; right: BooleanAST }
  | acorn.Node & { type: "ParenthesizedExpression"; expression: BooleanAST };

// --- 2. Validate expression against schema keys ---
function validateExpressionForSchema(expr: string, schemaKeys: string[]): boolean {
  try {
    const astElement = acorn.parseExpressionAt(expr, 0, { ecmaVersion: 2020 }) as BooleanAST;

    const validateElement = (element: BooleanAST): boolean => {
      switch (element.type) {
        case "Identifier":
          return schemaKeys.includes(element.name); // only schema keys
        case "Literal":
          return true; // always boolean by type
        case "UnaryExpression":
          return element.operator === "!" && validateElement(element.argument);
        case "BinaryExpression":
        case "LogicalExpression":
          return validateElement(element.left) && validateElement(element.right);
        case "ParenthesizedExpression":
          return validateElement(element.expression);
        default:
          return false;
      }
    };

    return validateElement(astElement);
  } catch {
    return false; // invalid syntax
  }
}

// --- 3. Create type-safe evaluator ---
function createBooleanEvaluator<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  expr: string
): ((obj: z.infer<typeof schema>) => boolean) | null {
  const keys = Object.keys(schema.shape);

  if (!validateExpressionForSchema(expr, keys)) return null;

  const fn = new Function(
    ...keys,
    `return (${expr});`
  ) as (...args: boolean[]) => boolean;

  return (obj: z.infer<typeof schema>) =>
    fn(...keys.map(k => obj[k as keyof typeof obj] as boolean));
}


// --- 4. Usage example ---
const schema = z.object({
  a: z.boolean(),
  b: z.boolean(),
});

const expr1 = "a && b";
const expr2 = "a && c"; // invalid: 'c' not in schema
const expr3 = "!a || b";

const evaluator1 = createBooleanEvaluator(schema, expr1);
const evaluator2 = createBooleanEvaluator(schema, expr2); // null
const evaluator3 = createBooleanEvaluator(schema, expr3);

const data = { a: true, b: false };

console.log("expr1:", evaluator1 ? evaluator1(data) : "invalid"); // false
console.log("expr2:", evaluator2 ? evaluator2(data) : "invalid"); // invalid
console.log("expr3:", evaluator3 ? evaluator3(data) : "invalid"); // true
