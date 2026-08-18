type CalculatorOperator = "+" | "-" | "*" | "/";
export type CalculatorDecimal = {
  readonly numerator: bigint;
  readonly denominator: bigint;
};
type CalculatorToken = CalculatorDecimal | CalculatorOperator | "(" | ")";
type CalculatorNumberRange = {
  readonly start: number;
  readonly end: number;
};

const DISPLAY_SCALE = 10;
const CHINESE_DIGITS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"] as const;
const CHINESE_GROUP_UNITS = ["", "万", "亿", "兆", "京", "垓", "秭", "穰"] as const;

function isCalculatorOperator(token: unknown): token is CalculatorOperator {
  return token === "+" || token === "-" || token === "*" || token === "/";
}

function getCalculatorPrecedence(operator: CalculatorOperator): number {
  return operator === "+" || operator === "-" ? 1 : 2;
}

function absoluteBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function greatestCommonDivisor(leftValue: bigint, rightValue: bigint): bigint {
  let left = absoluteBigInt(leftValue);
  let right = absoluteBigInt(rightValue);

  while (right !== 0n) {
    const nextRight = left % right;
    left = right;
    right = nextRight;
  }

  return left || 1n;
}

function pow10(exponent: number): bigint {
  let value = 1n;

  for (let index = 0; index < exponent; index += 1) {
    value *= 10n;
  }

  return value;
}

function normalizeDecimal(decimal: CalculatorDecimal): CalculatorDecimal {
  if (decimal.denominator === 0n) {
    throw new Error("INVALID_EXPRESSION");
  }

  if (decimal.numerator === 0n) {
    return { numerator: 0n, denominator: 1n };
  }

  const sign = decimal.denominator < 0n ? -1n : 1n;
  const numerator = decimal.numerator * sign;
  const denominator = decimal.denominator * sign;
  const divisor = greatestCommonDivisor(numerator, denominator);

  return {
    numerator: numerator / divisor,
    denominator: denominator / divisor
  };
}

function parseCalculatorDecimal(numberText: string): CalculatorDecimal {
  const isNegative = numberText.startsWith("-");
  const unsignedNumberText = isNegative ? numberText.slice(1) : numberText;

  if (!unsignedNumberText || unsignedNumberText === ".") {
    throw new Error("INVALID_EXPRESSION");
  }

  const [integerPart = "", fractionPart = "", extraPart] = unsignedNumberText.split(".");

  if (extraPart !== undefined || !/^\d*$/.test(integerPart) || !/^\d*$/.test(fractionPart)) {
    throw new Error("INVALID_EXPRESSION");
  }

  const normalizedIntegerPart = integerPart || "0";
  const digits = `${normalizedIntegerPart}${fractionPart}`;

  if (!/^\d+$/.test(digits)) {
    throw new Error("INVALID_EXPRESSION");
  }

  return normalizeDecimal({
    numerator: BigInt(digits) * (isNegative ? -1n : 1n),
    denominator: pow10(fractionPart.length)
  });
}

function addDecimals(
  leftDecimal: CalculatorDecimal,
  rightDecimal: CalculatorDecimal
): CalculatorDecimal {
  return normalizeDecimal({
    numerator:
      leftDecimal.numerator * rightDecimal.denominator +
      rightDecimal.numerator * leftDecimal.denominator,
    denominator: leftDecimal.denominator * rightDecimal.denominator
  });
}

function subtractDecimals(
  leftDecimal: CalculatorDecimal,
  rightDecimal: CalculatorDecimal
): CalculatorDecimal {
  return normalizeDecimal({
    numerator:
      leftDecimal.numerator * rightDecimal.denominator -
      rightDecimal.numerator * leftDecimal.denominator,
    denominator: leftDecimal.denominator * rightDecimal.denominator
  });
}

function multiplyDecimals(
  leftDecimal: CalculatorDecimal,
  rightDecimal: CalculatorDecimal
): CalculatorDecimal {
  return normalizeDecimal({
    numerator: leftDecimal.numerator * rightDecimal.numerator,
    denominator: leftDecimal.denominator * rightDecimal.denominator
  });
}

function divideDecimals(
  leftDecimal: CalculatorDecimal,
  rightDecimal: CalculatorDecimal
): CalculatorDecimal {
  if (rightDecimal.numerator === 0n) {
    throw new Error("INVALID_EXPRESSION");
  }

  return normalizeDecimal({
    numerator: leftDecimal.numerator * rightDecimal.denominator,
    denominator: leftDecimal.denominator * rightDecimal.numerator
  });
}

function divideRounded(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new Error("INVALID_EXPRESSION");
  }

  const isNegative = (numerator < 0n) !== (denominator < 0n);
  const absoluteNumerator = absoluteBigInt(numerator);
  const absoluteDenominator = absoluteBigInt(denominator);
  let quotient = absoluteNumerator / absoluteDenominator;
  const remainder = absoluteNumerator % absoluteDenominator;

  if (remainder * 2n >= absoluteDenominator) {
    quotient += 1n;
  }

  return isNegative ? -quotient : quotient;
}

function formatScaledInteger(value: bigint, scale: number, shouldGroupThousands = true): string {
  const isNegative = value < 0n;
  const absoluteDigits = absoluteBigInt(value).toString();

  if (scale === 0) {
    return `${isNegative ? "-" : ""}${shouldGroupThousands ? formatThousands(absoluteDigits) : absoluteDigits}`;
  }

  const paddedDigits = absoluteDigits.padStart(scale + 1, "0");
  const rawIntegerPart = paddedDigits.slice(0, -scale);
  const integerPart = shouldGroupThousands ? formatThousands(rawIntegerPart) : rawIntegerPart;
  const fractionPart = paddedDigits.slice(-scale).replace(/0+$/, "");

  if (!fractionPart) {
    return `${isNegative ? "-" : ""}${integerPart}`;
  }

  return `${isNegative ? "-" : ""}${integerPart}.${fractionPart}`;
}

function formatThousands(integerText: string): string {
  return integerText.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatChineseFourDigitGroup(value: number): string {
  const units = ["千", "百", "十", ""] as const;
  const divisors = [1000, 100, 10, 1] as const;
  let remainingValue = value;
  let result = "";
  let shouldAppendZero = false;

  divisors.forEach((divisor, index) => {
    const digit = Math.floor(remainingValue / divisor);
    remainingValue %= divisor;

    if (digit === 0) {
      if (result) {
        shouldAppendZero = true;
      }
      return;
    }

    if (shouldAppendZero) {
      result += "零";
      shouldAppendZero = false;
    }

    const unit = units[index];
    result += unit === "十" && digit === 1 && !result ? unit : `${CHINESE_DIGITS[digit]}${unit}`;
  });

  return result;
}

function formatChineseInteger(integerText: string): string {
  const normalizedIntegerText = integerText.replace(/^0+/, "") || "0";

  if (normalizedIntegerText === "0") {
    return "零";
  }

  const groups: number[] = [];

  for (let index = normalizedIntegerText.length; index > 0; index -= 4) {
    groups.unshift(Number(normalizedIntegerText.slice(Math.max(0, index - 4), index)));
  }

  let result = "";
  let shouldAppendZero = false;

  groups.forEach((groupValue, index) => {
    const unitIndex = groups.length - index - 1;

    if (groupValue === 0) {
      if (result) {
        shouldAppendZero = true;
      }
      return;
    }

    if (result && (shouldAppendZero || groupValue < 1000)) {
      result += "零";
    }

    result += `${formatChineseFourDigitGroup(groupValue)}${CHINESE_GROUP_UNITS[unitIndex] ?? ""}`;
    shouldAppendZero = false;
  });

  return result;
}

function getTerminatingDecimalScale(denominator: bigint): number | null {
  let remainingDenominator = denominator;
  let twoCount = 0;
  let fiveCount = 0;

  while (remainingDenominator % 2n === 0n) {
    remainingDenominator /= 2n;
    twoCount += 1;
  }

  while (remainingDenominator % 5n === 0n) {
    remainingDenominator /= 5n;
    fiveCount += 1;
  }

  return remainingDenominator === 1n ? Math.max(twoCount, fiveCount) : null;
}

function tokenizeCalculatorExpression(expression: string): CalculatorToken[] {
  const tokens: CalculatorToken[] = [];
  const normalizedExpression = expression.replace(/[×]/g, "*").replace(/[÷]/g, "/");
  let index = 0;

  while (index < normalizedExpression.length) {
    const character = normalizedExpression[index];

    if (/\s/.test(character)) {
      index += 1;
      continue;
    }

    const previousToken = tokens[tokens.length - 1];
    const isUnaryMinus =
      character === "-" &&
      (!previousToken || previousToken === "(" || isCalculatorOperator(previousToken));

    if (isUnaryMinus && normalizedExpression[index + 1] === "(") {
      tokens.push({ numerator: 0n, denominator: 1n }, "-");
      index += 1;
      continue;
    }

    if (/\d|\./.test(character) || isUnaryMinus) {
      let numberText = isUnaryMinus ? "-" : "";

      if (isUnaryMinus) {
        index += 1;
      }

      while (index < normalizedExpression.length && /[\d.]/.test(normalizedExpression[index])) {
        numberText += normalizedExpression[index];
        index += 1;
      }

      tokens.push(parseCalculatorDecimal(numberText));
      continue;
    }

    if (character === "+" || character === "-" || character === "*" || character === "/") {
      tokens.push(character);
      index += 1;
      continue;
    }

    if (character === "(" || character === ")") {
      tokens.push(character);
      index += 1;
      continue;
    }

    throw new Error("INVALID_EXPRESSION");
  }

  return tokens;
}

export function evaluateCalculatorExpression(expression: string): CalculatorDecimal {
  const tokens = tokenizeCalculatorExpression(expression);
  const outputQueue: (CalculatorDecimal | CalculatorOperator)[] = [];
  const operatorStack: (CalculatorOperator | "(")[] = [];

  tokens.forEach((token) => {
    if (typeof token === "object") {
      outputQueue.push(token);
      return;
    }

    if (isCalculatorOperator(token)) {
      while (operatorStack.length > 0) {
        const topOperator = operatorStack[operatorStack.length - 1];

        if (
          topOperator === "(" ||
          getCalculatorPrecedence(topOperator) < getCalculatorPrecedence(token)
        ) {
          break;
        }

        outputQueue.push(operatorStack.pop() as CalculatorOperator);
      }

      operatorStack.push(token);
      return;
    }

    if (token === "(") {
      operatorStack.push(token);
      return;
    }

    while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== "(") {
      outputQueue.push(operatorStack.pop() as CalculatorOperator);
    }

    if (operatorStack.pop() !== "(") {
      throw new Error("INVALID_EXPRESSION");
    }
  });

  while (operatorStack.length > 0) {
    const operator = operatorStack.pop();

    if (!operator || operator === "(") {
      throw new Error("INVALID_EXPRESSION");
    }

    outputQueue.push(operator);
  }

  const valueStack: CalculatorDecimal[] = [];

  outputQueue.forEach((token) => {
    if (typeof token === "object") {
      valueStack.push(token);
      return;
    }

    const rightValue = valueStack.pop();
    const leftValue = valueStack.pop();

    if (leftValue === undefined || rightValue === undefined) {
      throw new Error("INVALID_EXPRESSION");
    }

    const nextValue =
      token === "+"
        ? addDecimals(leftValue, rightValue)
        : token === "-"
          ? subtractDecimals(leftValue, rightValue)
          : token === "*"
            ? multiplyDecimals(leftValue, rightValue)
            : divideDecimals(leftValue, rightValue);

    valueStack.push(nextValue);
  });

  if (valueStack.length !== 1) {
    throw new Error("INVALID_EXPRESSION");
  }

  return valueStack[0];
}

export function formatCalculatorResult(decimal: CalculatorDecimal): string {
  return formatCalculatorDecimal(decimal, true);
}

export function formatCalculatorChineseDescription(decimal: CalculatorDecimal): string {
  const plainResult = formatCalculatorPlainResult(decimal);
  const isNegative = plainResult.startsWith("-");
  const [integerPart, fractionPart] = (isNegative ? plainResult.slice(1) : plainResult).split(".");

  if (integerPart.replace(/^0+/, "").length <= 3) {
    return "";
  }

  const integerDescription = `${isNegative ? "负" : ""}${formatChineseInteger(integerPart)}`;

  if (!fractionPart) {
    return integerDescription;
  }

  return `${integerDescription}点${fractionPart
    .split("")
    .map((digit) => CHINESE_DIGITS[Number(digit)])
    .join("")}`;
}

function formatCalculatorPlainResult(decimal: CalculatorDecimal): string {
  return formatCalculatorDecimal(decimal, false);
}

function formatCalculatorDecimal(decimal: CalculatorDecimal, shouldGroupThousands: boolean): string {
  const normalizedDecimal = normalizeDecimal(decimal);

  const terminatingScale = getTerminatingDecimalScale(normalizedDecimal.denominator);

  if (terminatingScale !== null) {
    const scaleMultiplier = pow10(terminatingScale) / normalizedDecimal.denominator;
    return formatScaledInteger(
      normalizedDecimal.numerator * scaleMultiplier,
      terminatingScale,
      shouldGroupThousands
    );
  }

  return formatScaledInteger(
    divideRounded(normalizedDecimal.numerator * pow10(DISPLAY_SCALE), normalizedDecimal.denominator),
    DISPLAY_SCALE,
    shouldGroupThousands
  );
}

function findCurrentNumberRange(expression: string): CalculatorNumberRange | null {
  let end = expression.length;

  while (end > 0 && /\s/.test(expression[end - 1])) {
    end -= 1;
  }

  let start = end;

  while (start > 0 && /[\d.]/.test(expression[start - 1])) {
    start -= 1;
  }

  if (start === end) {
    return null;
  }

  const minusIndex = start - 1;

  if (
    expression[minusIndex] === "-" &&
    (minusIndex === 0 ||
      expression[minusIndex - 1] === "(" ||
      isCalculatorOperator(expression[minusIndex - 1]))
  ) {
    start = minusIndex;
  }

  return { start, end };
}

export function percentCurrentCalculatorNumber(expression: string): string {
  const range = findCurrentNumberRange(expression);

  if (!range) {
    return expression;
  }

  try {
    const currentNumber = parseCalculatorDecimal(expression.slice(range.start, range.end));
    return `${expression.slice(0, range.start)}${formatCalculatorPlainResult({
      numerator: currentNumber.numerator,
      denominator: currentNumber.denominator * 100n
    })}${expression.slice(range.end)}`;
  } catch {
    return expression;
  }
}

export function toggleCurrentCalculatorNumberSign(expression: string): string {
  const range = findCurrentNumberRange(expression);

  if (!range) {
    return expression;
  }

  if (expression[range.start] === "-") {
    return `${expression.slice(0, range.start)}${expression.slice(range.start + 1)}`;
  }

  return `${expression.slice(0, range.start)}-${expression.slice(range.start)}`;
}
