const one = [1n];

function linear(root) {
  return root === 0n ? one : [1n, -root];
}

function product(left, right) {
  const result = Array(left.length + right.length - 1).fill(0n);
  for (const [i, a] of left.entries()) {
    for (const [j, b] of right.entries()) result[i + j] += a * b;
  }
  return result;
}

function power(polynomial, exponent) {
  let result = one;
  for (let i = 0; i < exponent; i++) result = product(result, polynomial);
  return result;
}

function oneMinusPower(exponent) {
  const coefficients = Array(exponent + 1).fill(0n);
  coefficients[0] = 1n;
  coefficients[exponent] = -1n;
  return coefficients;
}

function ratio(numerator = one, denominator = one) {
  return {numerator, denominator};
}

function geometric(root) {
  return ratio(one, linear(root));
}

function exponentParameter(defaultValue = 1) {
  return {label: 'Exponent k', default: defaultValue, min: 0, max: 8};
}

function localCharacter(prime, modulus, positive, negative) {
  const residue = Number(prime % BigInt(modulus));
  if (positive.includes(residue)) return 1n;
  if (negative.includes(residue)) return -1n;
  return 0n;
}

function character({id, symbol, discriminant, modulus, positive, negative, description}) {
  return {
    id,
    name: `Quadratic character of discriminant ${discriminant}`,
    symbol,
    category: 'Characters',
    description,
    aliases: [`modulo ${modulus}`, `mod ${modulus}`, 'Kronecker symbol', 'Dirichlet character'],
    inverse: `Pointwise product μ · ${symbol}`,
    series: p => geometric(localCharacter(p, modulus, positive, negative))
  };
}

export const catalog = [
  {
    id: 'one', name: 'Constant function', symbol: '𝟙', category: 'Basics',
    description: 'Assigns 1 to every positive integer.',
    aliases: ['one', 'zeta'], inverse: 'Möbius function μ',
    series: () => geometric(1n)
  },
  {
    id: 'mu', name: 'Möbius function', symbol: 'μ', category: 'Basics',
    description: 'Assigns zero if a prime square divides n, and otherwise alternates with the number of prime divisors.',
    aliases: ['mobius', 'moebius', 'inclusion exclusion'], inverse: 'Constant function 𝟙',
    series: () => ratio(linear(1n))
  },
  {
    id: 'epsilon', name: 'Convolution identity', symbol: 'ε', category: 'Basics',
    description: 'Assigns 1 at n = 1 and zero everywhere else.',
    aliases: ['delta', 'unit', 'identity element'], inverse: 'ε',
    series: () => ratio()
  },
  {
    id: 'power', name: 'Power function', symbol: 'idₖ', category: 'Basics',
    description: 'Assigns the kth power nᵏ to n. The choice k = 1 gives the identity map on integers.',
    aliases: ['identity map', 'power weight', 'monomial'], inverse: 'Pointwise product μ(n) nᵏ',
    parameter: exponentParameter(), series: (p, k) => geometric(p ** BigInt(k))
  },
  {
    id: 'tau', name: 'Divisor count', symbol: 'τ', category: 'Divisor sums',
    description: 'Counts the positive divisors of n.',
    aliases: ['d', 'd(n)', 'sigma zero', 'tau'], inverse: 'μ * μ',
    series: () => ratio(one, power(linear(1n), 2))
  },
  {
    id: 'sigma', name: 'Sum of divisor powers', symbol: 'σₖ', category: 'Divisor sums',
    description: 'Sums dᵏ over the positive divisors d of n.',
    aliases: ['sigma', 'divisor sum', 'sum of divisors', 'perfect numbers'],
    inverse: 'μ * (μ · idₖ)', parameter: exponentParameter(),
    series: (p, k) => ratio(one, product(linear(1n), linear(p ** BigInt(k))))
  },
  {
    id: 'divisor-tuples', name: 'Ordered factorization count', symbol: 'dₖ', category: 'Divisor sums',
    description: 'Counts ordered k-tuples of positive integers whose product is n.',
    aliases: ['generalized divisor function', 'Piltz', 'convolution power', 'factorization'],
    inverse: 'The k-fold Dirichlet convolution of μ',
    parameter: {label: 'Number of factors k', default: 3, min: 2, max: 8},
    series: (_, k) => ratio(one, power(linear(1n), k))
  },
  {
    id: 'divisor-squares', name: 'Divisors of the square', symbol: 'τ(n²)', category: 'Divisor sums',
    description: 'Counts the positive divisors of n². At pᵃ the count is 2a + 1.',
    aliases: ['divisor count at n squared', 'divisors of n squared'], inverse: 'λ * μ * μ',
    series: () => ratio(linear(-1n), power(linear(1n), 2))
  },
  {
    id: 'square-divisors', name: 'Square divisor count', symbol: 'τ□', category: 'Divisor sums',
    description: 'Counts the perfect squares among the positive divisors of n.',
    aliases: ['square divisors', 'count divisors which are squares'],
    inverse: 'Local series (1 − t)(1 − t²)',
    series: () => ratio(one, product(linear(1n), oneMinusPower(2)))
  },
  {
    id: 'squared-divisor-count', name: 'Squared divisor count', symbol: 'τ(n)²', category: 'Divisor sums',
    description: 'Counts ordered pairs of positive divisors of n.',
    aliases: ['tau squared', 'pointwise square of divisor count'],
    inverse: 'λ * μ * μ * μ',
    series: () => ratio(linear(-1n), power(linear(1n), 3))
  },
  {
    id: 'unitary-count', name: 'Unitary divisor count', symbol: '2^ω', category: 'Divisor sums',
    description: 'Counts divisors d for which d and n/d are coprime.',
    aliases: ['unitary', 'unitary divisors', 'two to the omega', 'squarefree divisor count'],
    inverse: 'Pointwise product λ(n) 2^ω(n)',
    series: () => ratio(linear(-1n), linear(1n))
  },
  {
    id: 'unitary-sum', name: 'Sum of unitary divisor powers', symbol: 'σₖ⁎', category: 'Divisor sums',
    description: 'Sums dᵏ over divisors d for which d and n/d are coprime.',
    aliases: ['unitary divisor sum', 'unitary sigma'], parameter: exponentParameter(),
    inverse: 'Local series (1 − t)(1 − pᵏt) / (1 − pᵏt²)',
    series: (p, k) => {
      const q = p ** BigInt(k);
      return ratio([1n, 0n, -q], product(linear(1n), linear(q)));
    }
  },
  {
    id: 'sigma-square-argument', name: 'Divisor sum of the square', symbol: 'σ₁(n²)', category: 'Divisor sums',
    description: 'Adds all the positive divisors of n².',
    aliases: ['sum divisors of n squared'], inverse: 'Local series (1 − t)(1 − p²t) / (1 + pt)',
    series: p => ratio(linear(-p), product(linear(1n), linear(p ** 2n)))
  },
  {
    id: 'phi', name: 'Euler totient', symbol: 'φ', category: 'Totients',
    description: 'Counts integers in 1 through n that are coprime to n.',
    aliases: ['euler phi', 'euler function', 'totient function'],
    inverse: 'Product of (1 − p) over the distinct primes p dividing n',
    series: p => ratio(linear(1n), linear(p))
  },
  {
    id: 'jordan', name: 'Jordan totient', symbol: 'Jₖ', category: 'Totients',
    description: 'Counts k-tuples in 1 through n with no common prime divisor of n.',
    aliases: ['jordan phi', 'higher totient', 'coprime tuples', 'primitive tuples'],
    inverse: 'Product of (1 − pᵏ) over the distinct primes p dividing n',
    parameter: {label: 'Tuple size k', default: 2, min: 1, max: 8},
    series: (p, k) => ratio(linear(1n), linear(p ** BigInt(k)))
  },
  {
    id: 'psi', name: 'Dedekind psi function', symbol: 'ψ', category: 'Totients',
    description: 'Multiplies n by one factor (1 + 1/p) for each distinct prime p dividing n.',
    aliases: ['dedekind psi', 'projective line', 'psi'], inverse: 'λ * (μ · id₁)',
    series: p => ratio(linear(-1n), linear(p))
  },
  {
    id: 'radical', name: 'Radical', symbol: 'rad', category: 'Prime factors',
    description: 'Multiplies the distinct prime divisors of n together.',
    aliases: ['squarefree kernel', 'product of distinct primes'],
    inverse: 'At pᵃ with a ≥ 1, the inverse is −p(1 − p)ᵃ⁻¹',
    series: p => ratio(linear(1n - p), linear(1n))
  },
  {
    id: 'lambda', name: 'Liouville function', symbol: 'λ', category: 'Prime factors',
    description: 'Alternates between 1 and −1 according to the total number of prime factors counted with multiplicity.',
    aliases: ['lambda', 'liouville parity', 'big omega parity'], inverse: 'Squarefree indicator μ²',
    series: () => geometric(-1n)
  },
  {
    id: 'signed-distinct', name: 'Parity of distinct prime factors', symbol: '(−1)^ω', category: 'Prime factors',
    description: 'Alternates between 1 and −1 according to the number of distinct prime divisors.',
    aliases: ['little omega parity', 'unitary mobius', 'unitary Möbius'],
    inverse: '2 raised to Ω(n) − ω(n)',
    series: () => ratio(linear(2n), linear(1n))
  },
  {
    id: 'omega-weight', name: 'Weight per distinct prime', symbol: 'k^ω', category: 'Prime factors',
    description: 'Multiplies by k once for each distinct prime divisor of n.',
    aliases: ['little omega', 'number of distinct prime factors', 'weighted distinct primes'],
    inverse: 'Local series (1 − t) / (1 + (k − 1)t)',
    parameter: {label: 'Weight k', default: 3, min: 2, max: 8},
    series: (_, k) => ratio(linear(1n - BigInt(k)), linear(1n))
  },
  {
    id: 'omega-total-weight', name: 'Weight per prime factor', symbol: 'k^Ω', category: 'Prime factors',
    description: 'Multiplies by k for each prime factor of n counted with multiplicity.',
    aliases: ['big omega', 'total number of prime factors', 'completely multiplicative'],
    inverse: 'Pointwise product μ(n) k^Ω(n)',
    parameter: {label: 'Weight k', default: 2, min: 2, max: 8},
    series: (_, k) => geometric(BigInt(k))
  },
  {
    id: 'squarefree', name: 'Squarefree indicator', symbol: 'μ²', category: 'Indicators',
    description: 'Assigns 1 when n is squarefree and zero when a prime square divides n.',
    aliases: ['square free', 'squares', 'mobius squared'], inverse: 'Liouville function λ',
    series: () => ratio(linear(-1n))
  },
  {
    id: 'power-free', name: 'Power-free indicator', symbol: '𝟙ₖ₋free', category: 'Indicators',
    description: 'Assigns 1 when n is divisible by no kth power of a prime, and zero otherwise.',
    aliases: ['cube free', 'cubefree', 'k free', 'power free'],
    inverse: 'Local series (1 − t) / (1 − tᵏ)',
    parameter: {label: 'Power k', default: 3, min: 2, max: 8},
    series: (_, k) => ratio(Array(k).fill(1n))
  },
  {
    id: 'perfect-power', name: 'Perfect power indicator', symbol: '𝟙ₖ₋power', category: 'Indicators',
    description: 'Assigns 1 when n is a perfect kth power, and zero otherwise.',
    aliases: ['square indicator', 'cube indicator', 'perfect square', 'perfect cube'],
    inverse: 'μ(m) when n = mᵏ, and 0 otherwise',
    parameter: {label: 'Power k', default: 2, min: 2, max: 8},
    series: (_, k) => ratio(one, oneMinusPower(k))
  },
  {
    id: 'powerful', name: 'Powerful number indicator', symbol: '𝟙powerful', category: 'Indicators',
    description: 'Assigns 1 when the exponent of every prime dividing n is at least two, and zero otherwise.',
    aliases: ['squarefull', 'squareful', 'powerful number', 'square full'],
    inverse: 'Local series (1 − t) / (1 − t + t²)',
    series: () => ratio([1n, -1n, 1n], linear(1n))
  },
  {
    id: 'gcd-fixed', name: 'GCD with a fixed modulus', symbol: 'gcd(n,m)', category: 'Prime factors',
    description: 'Assigns the greatest common divisor of n and a fixed positive integer m.',
    aliases: ['greatest common divisor', 'fixed gcd'],
    inverse: 'Local series (1 − t) divided by the sum of φ(pʲ)tʲ for 0 ≤ j ≤ vₚ(m)',
    parameter: {label: 'Modulus m', default: 12, min: 1, max: 30},
    series: (p, m) => {
      let remaining = BigInt(m);
      let primePower = 1n;
      const numerator = [1n];
      while (remaining % p === 0n) {
        numerator.push(primePower * (p - 1n));
        primePower *= p;
        remaining /= p;
      }
      return ratio(numerator, linear(1n));
    }
  },
  {
    id: 'principal-character', name: 'Principal Dirichlet character', symbol: 'χ₀', category: 'Characters',
    description: 'Assigns 1 when n is coprime to the chosen modulus m, and zero otherwise.',
    aliases: ['principal character', 'coprime indicator', 'unit group'],
    inverse: 'Pointwise product μ · χ₀',
    parameter: {label: 'Modulus m', default: 12, min: 1, max: 30},
    series: (p, m) => geometric(BigInt(m) % p === 0n ? 0n : 1n)
  },
  character({
    id: 'chi-minus-4', symbol: 'χ₋₄', discriminant: '−4', modulus: 4, positive: [1], negative: [3],
    description: 'Assigns 1 on residue 1 modulo 4, −1 on residue 3, and zero on even integers.'
  }),
  character({
    id: 'chi-5', symbol: 'χ₅', discriminant: '5', modulus: 5, positive: [1, 4], negative: [2, 3],
    description: 'Assigns 1 on the nonzero quadratic residues modulo 5, −1 on the nonresidues, and zero on multiples of 5.'
  }),
  character({
    id: 'chi-8', symbol: 'χ₈', discriminant: '8', modulus: 8, positive: [1, 7], negative: [3, 5],
    description: 'Assigns 1 on residues ±1 modulo 8, −1 on ±3, and zero on even integers.'
  }),
  character({
    id: 'chi-12', symbol: 'χ₁₂', discriminant: '12', modulus: 12, positive: [1, 11], negative: [5, 7],
    description: 'Assigns 1 on residues ±1 modulo 12, −1 on ±5, and zero on integers sharing a factor with 12.'
  }),
  {
    id: 'two-squares', name: 'Normalized two-square count', symbol: 'r₂/4', category: 'Sums of squares',
    description: 'Counts ordered signed representations of n as two integer squares and divides by 4.',
    aliases: ['sum of two squares', 'Gaussian integers', 'r2', '1 * chi -4'], inverse: 'μ * (μ · χ₋₄)',
    series: p => ratio(one, product(linear(1n), linear(localCharacter(p, 4, [1], [3]))))
  },
  {
    id: 'four-squares', name: 'Normalized four-square count', symbol: 'r₄/8', category: 'Sums of squares',
    description: 'Counts ordered signed representations of n as four integer squares and divides by 8.',
    aliases: ['sum of four squares', 'Jacobi four squares', 'r4'],
    inverse: 'Local series (1 − t) / (1 + 2t) at p = 2, and (1 − t)(1 − pt) at odd primes',
    series: p => p === 2n ? ratio([1n, 2n], linear(1n)) : ratio(one, product(linear(1n), linear(p)))
  }
];
