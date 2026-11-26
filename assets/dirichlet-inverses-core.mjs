export function factorInteger(n) {
  if (typeof n !== 'bigint' && !Number.isSafeInteger(n)) {
    throw new RangeError('Enter a positive integer.');
  }
  if (n < 1) throw new RangeError('Enter a positive integer.');

  let remaining = BigInt(n);
  const factors = [];
  for (let prime = 2n; prime * prime <= remaining; prime += prime === 2n ? 1n : 2n) {
    let exponent = 0;
    while (remaining % prime === 0n) {
      remaining /= prime;
      exponent += 1;
    }
    if (exponent > 0) factors.push({prime, exponent});
  }
  if (remaining > 1n) factors.push({prime: remaining, exponent: 1});
  return factors;
}

export function primePowerCoefficients(series, maxExponent, swap = false) {
  if (!Number.isSafeInteger(maxExponent) || maxExponent < 0) {
    throw new RangeError('The exponent must be a nonnegative integer.');
  }

  const numerator = swap ? series.denominator : series.numerator;
  const denominator = swap ? series.numerator : series.denominator;
  if (numerator[0] !== 1n || denominator[0] !== 1n) {
    throw new RangeError('Both polynomials must have constant term 1.');
  }

  // The denominator times the series is the numerator, coefficient by coefficient.
  const coefficients = [1n];
  for (let exponent = 1; exponent <= maxExponent; exponent += 1) {
    let coefficient = numerator[exponent] ?? 0n;
    for (let degree = 1; degree <= exponent && degree < denominator.length; degree += 1) {
      coefficient -= denominator[degree] * coefficients[exponent - degree];
    }
    coefficients.push(coefficient);
  }
  return coefficients;
}

export function evaluateConvolution(entry, n, k, swap = false) {
  const factors = factorInteger(n).map(({prime, exponent}) => {
    const series = entry.series(prime, k);
    return {
      prime,
      exponent,
      values: primePowerCoefficients(series, exponent, swap),
      inverseValues: primePowerCoefficients(series, exponent, !swap)
    };
  });

  let value = 1n;
  let inverseValue = 1n;
  let divisors = [{divisor: 1n, value: 1n, inverseValue: 1n}];
  for (const factor of factors) {
    const {prime, exponent, values, inverseValues} = factor;
    value *= values[exponent];
    inverseValue *= inverseValues[exponent];

    // To extend f(d)g(n/d) by this prime, pair p^i with p^(exponent-i).
    const extendedDivisors = [];
    for (const item of divisors) {
      let primePower = 1n;
      for (let i = 0; i <= exponent; i += 1) {
        extendedDivisors.push({
          divisor: item.divisor * primePower,
          value: item.value * values[i],
          inverseValue: item.inverseValue * inverseValues[exponent - i]
        });
        primePower *= prime;
      }
    }
    divisors = extendedDivisors;
  }

  const integer = BigInt(n);
  const terms = divisors.map(item => ({
    ...item,
    quotient: integer / item.divisor,
    product: item.value * item.inverseValue
  }));
  terms.sort((a, b) => Number(a.divisor > b.divisor) - Number(a.divisor < b.divisor));
  const sum = terms.reduce((total, term) => total + term.product, 0n);
  return {factors, value, inverseValue, terms, sum};
}
