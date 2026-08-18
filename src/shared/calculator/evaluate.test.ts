import { describe, expect, it } from "vitest";
import {
  evaluateCalculatorExpression,
  formatCalculatorChineseDescription,
  formatCalculatorResult,
  percentCurrentCalculatorNumber,
  toggleCurrentCalculatorNumberSign
} from "./evaluate";

function evaluate(expression: string): string {
  return formatCalculatorResult(evaluateCalculatorExpression(expression));
}

function describeResult(expression: string): string {
  return formatCalculatorChineseDescription(evaluateCalculatorExpression(expression));
}

describe("calculator", () => {
  it("evaluates arithmetic expressions", () => {
    expect(evaluate("1+2*(3-4)")).toBe("-1");
    expect(evaluate("(8+4)/3")).toBe("4");
    expect(evaluate("-2*(3+4)")).toBe("-14");
  });

  it("supports calculator button operators", () => {
    expect(evaluate("6÷2")).toBe("3");
    expect(evaluate("6×2")).toBe("12");
  });

  it("formats decimal results", () => {
    expect(evaluate("1/3")).toBe("0.3333333333");
  });

  it("avoids binary floating point errors", () => {
    expect(evaluate("0.1+0.2")).toBe("0.3");
    expect(evaluate("0.3-0.1")).toBe("0.2");
    expect(evaluate("0.7*0.05")).toBe("0.035");
  });

  it("keeps large integer arithmetic exact", () => {
    expect(evaluate("1000000000+2000000000")).toBe("3,000,000,000");
    expect(evaluate("999999999999999999999999999999+1")).toBe(
      "1,000,000,000,000,000,000,000,000,000,000"
    );
  });

  it("formats Chinese result descriptions", () => {
    expect(describeResult("246")).toBe("");
    expect(describeResult("999.99")).toBe("");
    expect(describeResult("180000000")).toBe("一亿八千万");
    expect(describeResult("1000000000+2000000000")).toBe("三十亿");
    expect(describeResult("1234.56")).toBe("一千二百三十四点五六");
    expect(describeResult("-10001")).toBe("负一万零一");
  });

  it("keeps multi-digit decimal arithmetic exact", () => {
    expect(evaluate("0.123456789+0.987654321")).toBe("1.11111111");
    expect(evaluate("999999999999.999999999+0.000000001")).toBe("1,000,000,000,000");
    expect(evaluate("0.000000001*0.000000001")).toBe("0.000000000000000001");
  });

  it("does not round division before later operations", () => {
    expect(evaluate("1/6*6")).toBe("1");
    expect(evaluate("1/7*7")).toBe("1");
    expect(evaluate("10/3*3")).toBe("10");
  });

  it("applies percent to the current number", () => {
    expect(percentCurrentCalculatorNumber("50")).toBe("0.5");
    expect(percentCurrentCalculatorNumber("12+50")).toBe("12+0.5");
    expect(percentCurrentCalculatorNumber("12-5")).toBe("12-0.05");
  });

  it("toggles the current number sign", () => {
    expect(toggleCurrentCalculatorNumberSign("5")).toBe("-5");
    expect(toggleCurrentCalculatorNumberSign("-5")).toBe("5");
    expect(toggleCurrentCalculatorNumberSign("12+5")).toBe("12+-5");
    expect(toggleCurrentCalculatorNumberSign("12-5")).toBe("12--5");
  });

  it("rejects invalid expressions", () => {
    expect(() => evaluateCalculatorExpression("1++2")).toThrow();
    expect(() => evaluateCalculatorExpression("1/0")).toThrow();
  });
});
