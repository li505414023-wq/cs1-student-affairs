import type { ExpressionContext } from "./types";

/**
 * Safe expression evaluator for workflow conditions.
 * Uses a recursive descent parser — NO eval() or new Function().
 *
 * Supported:
 * - Comparison: ==, !=, >, <, >=, <=
 * - Logic: &&, ||, !
 * - Variable reference: ${fieldName} resolved from formData
 * - String literals: 'value' or "value"
 * - Numeric literals
 * - Parentheses for grouping
 */

type Token =
  | { type: "var"; name: string }
  | { type: "string"; value: string }
  | { type: "number"; value: number }
  | { type: "op"; value: string }
  | { type: "lparen" }
  | { type: "rparen" }
  | { type: "not" };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Variable: ${...}
    if (ch === "$" && expr[i + 1] === "{") {
      const end = expr.indexOf("}", i + 2);
      if (end === -1) throw new Error(`Unclosed variable reference at position ${i}`);
      const name = expr.slice(i + 2, end).trim();
      tokens.push({ type: "var", name });
      i = end + 1;
      continue;
    }

    // String literals
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let str = "";
      i++;
      while (i < expr.length && expr[i] !== quote) {
        if (expr[i] === "\\") i++;
        str += expr[i];
        i++;
      }
      if (i >= expr.length) throw new Error("Unclosed string literal");
      tokens.push({ type: "string", value: str });
      i++;
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch)) {
      let num = "";
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i];
        i++;
      }
      tokens.push({ type: "number", value: parseFloat(num) });
      continue;
    }

    // Two-char operators
    if ((ch === "=" && expr[i + 1] === "=") ||
        (ch === "!" && expr[i + 1] === "=") ||
        (ch === ">" && expr[i + 1] === "=") ||
        (ch === "<" && expr[i + 1] === "=")) {
      tokens.push({ type: "op", value: expr.slice(i, i + 2) });
      i += 2;
      continue;
    }

    // Two-char logic
    if (ch === "&" && expr[i + 1] === "&") {
      tokens.push({ type: "op", value: "&&" });
      i += 2;
      continue;
    }
    if (ch === "|" && expr[i + 1] === "|") {
      tokens.push({ type: "op", value: "||" });
      i += 2;
      continue;
    }

    // Single-char tokens
    if (">=<".includes(ch)) {
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }
    if (ch === "!") {
      tokens.push({ type: "not" });
      i++;
      continue;
    }
    if (ch === "(") { tokens.push({ type: "lparen" }); i++; continue; }
    if (ch === ")") { tokens.push({ type: "rparen" }); i++; continue; }

    throw new Error(`Unexpected character '${ch}' at position ${i}`);
  }

  return tokens;
}

// AST nodes
type ExprNode =
  | { type: "literal"; value: string | number }
  | { type: "variable"; name: string }
  | { type: "binary"; op: string; left: ExprNode; right: ExprNode }
  | { type: "unary"; op: string; operand: ExprNode };

type ValueToken = Token & { value: string };

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): ExprNode {
    return this.parseOr();
  }

  private parseOr(): ExprNode {
    let left = this.parseAnd();
    while (this.match("op", "||")) {
      const op = this.advanceAs<"op">("op", "||").value;
      const right = this.parseAnd();
      left = { type: "binary", op, left, right };
    }
    return left;
  }

  private parseAnd(): ExprNode {
    let left = this.parseEquality();
    while (this.match("op", "&&")) {
      const op = this.advanceAs<"op">("op", "&&").value;
      const right = this.parseEquality();
      left = { type: "binary", op, left, right };
    }
    return left;
  }

  private parseEquality(): ExprNode {
    let left = this.parseComparison();
    while (this.match("op", "==") || this.match("op", "!=")) {
      const op = (this.advance() as { type: "op"; value: string }).value;
      const right = this.parseComparison();
      left = { type: "binary", op, left, right };
    }
    return left;
  }

  private parseComparison(): ExprNode {
    let left = this.parseUnary();
    while (this.match("op", ">") || this.match("op", "<") ||
           this.match("op", ">=") || this.match("op", "<=")) {
      const op = (this.advance() as { type: "op"; value: string }).value;
      const right = this.parseUnary();
      left = { type: "binary", op, left, right };
    }
    return left;
  }

  private parseUnary(): ExprNode {
    if (this.match("not")) {
      this.advance();
      return { type: "unary", op: "!", operand: this.parseUnary() };
    }
    if (this.match("op", "!")) {
      this.advance();
      return { type: "unary", op: "!", operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ExprNode {
    if (this.match("lparen")) {
      this.advance();
      const node = this.parseOr();
      this.expect("rparen");
      this.advance();
      return node;
    }
    if (this.match("var")) {
      const token = this.advance() as { type: "var"; name: string };
      return { type: "variable", name: token.name };
    }
    if (this.match("string")) {
      const token = this.advance() as { type: "string"; value: string };
      return { type: "literal", value: token.value };
    }
    if (this.match("number")) {
      const token = this.advance() as { type: "number"; value: number };
      return { type: "literal", value: token.value };
    }
    throw new Error(`Unexpected token at position ${this.pos}`);
  }

  private match(type: string, value?: string): boolean {
    const token = this.tokens[this.pos];
    if (!token) return false;
    if (value !== undefined) return token.type === type && (token as ValueToken).value === value;
    return token.type === type;
  }

  private advanceAs<T extends string>(type: T, value?: string): Token & { value: string } {
    return this.advance() as Token & { value: string };
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private expect(_type: string) {
    if (!this.match(_type)) {
      throw new Error(`Expected ${_type} at position ${this.pos}`);
    }
  }
}

function evaluateNode(node: ExprNode, context: ExpressionContext): boolean | number | string {
  switch (node.type) {
    case "literal":
      return node.value;
    case "variable": {
      const value = context.formData[node.name];
      return value !== undefined ? String(value) : "";
    }
    case "binary": {
      const left = evaluateNode(node.left, context);
      const right = evaluateNode(node.right, context);
      return evalBinaryOp(node.op, left, right);
    }
    case "unary": {
      const operand = evaluateNode(node.operand, context);
      if (node.op === "!") return !operand;
      return operand;
    }
    default:
      return false;
  }
}

function evalBinaryOp(op: string, left: unknown, right: unknown): boolean {
  const l = typeof left === "number" ? left : Number(left);
  const r = typeof right === "number" ? right : Number(right);
  const ls = String(left ?? "");
  const rs = String(right ?? "");

  // Numeric comparison only when both sides look numeric
  const bothNumeric = !Number.isNaN(l) && !Number.isNaN(r) && typeof left !== "boolean" && typeof right !== "boolean";

  switch (op) {
    case "==": return bothNumeric ? l === r : ls === rs;
    case "!=": return bothNumeric ? l !== r : ls !== rs;
    case ">": return l > r;
    case "<": return l < r;
    case ">=": return l >= r;
    case "<=": return l <= r;
    case "&&": return Boolean(left) && Boolean(right);
    case "||": return Boolean(left) || Boolean(right);
    default: return false;
  }
}

/**
 * Evaluate a workflow condition expression against form data context.
 * Returns true/false for comparison/logic expressions.
 * Never uses eval() or new Function().
 *
 * Examples:
 *   evaluate("${days} > 3", { formData: { days: "5" } }) → true
 *   evaluate("${faculty} == '信息工程学院'", { formData: { faculty: "信息工程学院" } }) → true
 *   evaluate("${amount} >= 5000 && ${type} == '奖学金'", { formData: { amount: "6000", type: "奖学金" } }) → true
 */
export function evaluate(expression: string, context: ExpressionContext): boolean {
  if (!expression || !expression.trim()) return true; // Empty expression = pass-through
  try {
    const tokens = tokenize(expression);
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const result = evaluateNode(ast, context);
    return Boolean(result);
  } catch {
    return false;
  }
}
