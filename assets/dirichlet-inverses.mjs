import {catalog} from './dirichlet-inverses-catalog.mjs';
import {evaluateConvolution, primePowerCoefficients} from './dirichlet-inverses-core.mjs';

const byId = id => document.getElementById(id);
const search = byId('search');
const category = byId('category');
const rows = byId('function-rows');
const entriesById = new Map(catalog.map(entry => [entry.id, entry]));
const catalogRows = [...rows.querySelectorAll('button[data-function]')].map(button => ({
  button,
  row: button.closest('tr'),
  entry: entriesById.get(button.dataset.function)
}));
const integer = byId('integer');
const parameter = byId('parameter');
const parameterField = byId('parameter-field');
const prime = byId('prime');
const swap = byId('swap');
const invert = byId('invert');
const verification = byId('verification');
const title = byId('selected-title');
const seriesPanel = byId('series-title').closest('section');

const maxInteger = 1_000_000_000n;
const samplePrimes = [2n, 3n, 5n, 7n, 11n];
const superscript = exponent => String(exponent).replace(/\d/g, digit => '⁰¹²³⁴⁵⁶⁷⁸⁹'[digit]);
const compareBigInts = (a, b) => a < b ? -1 : Number(a > b);
const displayInteger = value => value.toLocaleString('en-US').replace('-', '−');

let active = catalog.find(entry => entry.id === 'tau');
let swapped = false;
let revealed = false;
let calculation;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function normalize(text) {
  return text.normalize('NFKD').toLowerCase().replace(/\p{Mark}/gu, '');
}

function renderCatalog() {
  const keywords = normalize(search.value).trim().split(/\s+/);
  let matches = 0;
  for (const {row, entry} of catalogRows) {
    const fields = [entry.name, entry.symbol, entry.category, entry.inverse, ...(entry.aliases ?? [])];
    const text = normalize(fields.join(' '));
    const inCategory = !category.value || entry.category === category.value;
    row.hidden = !(inCategory && keywords.every(keyword => text.includes(keyword)));
    if (!row.hidden) matches++;
  }
  byId('catalog-count').textContent = matches === catalog.length
    ? catalog.length + ' functions'
    : matches + ' of ' + catalog.length + ' functions';
  byId('no-functions').hidden = matches !== 0;
}

function updateTitle() {
  title.textContent = active.name + (swapped ? ' inverse' : '');
  byId('selected-description').textContent = swapped
    ? 'The current input is the Dirichlet inverse of ' + active.symbol + '.'
    : active.description;
  swap.setAttribute('aria-pressed', String(swapped));
}

function selectEntry(entry) {
  active = entry;
  swapped = false;
  revealed = false;
  parameterField.hidden = !entry.parameter;
  if (entry.parameter) {
    const {label, min, max, default: initial} = entry.parameter;
    byId('parameter-label').textContent = label;
    parameter.min = min;
    parameter.max = max;
    parameter.value = initial;
  }
  for (const {button, entry: rowEntry} of catalogRows) {
    button.setAttribute('aria-pressed', String(rowEntry === entry));
  }
  updateTitle();
  evaluate();
}

function polynomial(coefficients) {
  const terms = [];
  for (const [degree, coefficient] of coefficients.entries()) {
    if (coefficient === 0n) continue;
    const magnitude = coefficient < 0n ? -coefficient : coefficient;
    const variable = degree === 0 ? '' : 't' + (degree === 1 ? '' : superscript(degree));
    const term = (variable && magnitude === 1n ? '' : displayInteger(magnitude)) + variable;
    terms.push((terms.length ? (coefficient < 0n ? ' − ' : ' + ') : (coefficient < 0n ? '−' : '')) + term);
  }
  return terms.join('') || '0';
}

function rationalSeries(numerator, denominator) {
  if (denominator.every((coefficient, degree) => coefficient === (degree === 0 ? 1n : 0n))) return polynomial(numerator);
  const group = coefficients => coefficients.filter(coefficient => coefficient !== 0n).length > 1
    ? '(' + polynomial(coefficients) + ')'
    : polynomial(coefficients);
  return group(numerator) + ' / ' + group(denominator);
}

function renderSeries() {
  if (!calculation) return;
  const p = BigInt(prime.value);
  const series = active.series(p, calculation.k);
  const {numerator, denominator} = series;
  const original = rationalSeries(numerator, denominator);
  const reciprocal = rationalSeries(denominator, numerator);
  byId('source-formula').textContent = 'Fₚ(t) = ' + (swapped ? reciprocal : original);
  byId('inverse-formula').textContent = '1 / Fₚ(t) = ' + (swapped ? original : reciprocal);
  byId('reciprocal').hidden = !revealed;
  invert.setAttribute('aria-expanded', String(revealed));
  invert.textContent = revealed ? 'Hide reciprocal' : 'Invert series';

  const headings = element('tr');
  for (const heading of ['Power of p', '0', '1', '2', '3', '4', '5']) {
    const th = element('th', heading);
    th.scope = 'col';
    headings.append(th);
  }
  const thead = element('thead');
  thead.append(headings);
  const tbody = element('tbody');
  const addCoefficients = (label, isSwapped) => {
    const row = element('tr');
    const header = element('th', label);
    header.scope = 'row';
    row.append(header);
    for (const coefficient of primePowerCoefficients(series, 5, isSwapped)) {
      row.append(element('td', displayInteger(coefficient)));
    }
    tbody.append(row);
  };
  addCoefficients('f(pᵃ)', swapped);
  if (revealed) addCoefficients('f⁻¹(pᵃ)', !swapped);
  byId('coefficients').replaceChildren(thead, tbody);
}

function renderVerification() {
  if (!calculation || !verification.open) return;
  const {n, terms, sum} = calculation;
  byId('verification-result').textContent = 'Σ f(d)f⁻¹(n/d) = ' + displayInteger(sum)
    + ' = ε(' + displayInteger(n) + '). The sum runs over all positive divisors d of n.';
  const fragment = document.createDocumentFragment();
  for (const {divisor, quotient, value, inverseValue, product} of terms) {
    const row = element('tr');
    for (const item of [divisor, quotient, value, inverseValue, product]) row.append(element('td', displayInteger(item)));
    fragment.append(row);
  }
  byId('convolution-terms').replaceChildren(fragment);
}

function updatePrimes(factors) {
  const selected = prime.value;
  const choices = [...new Set([...samplePrimes, ...factors.map(factor => factor.prime)])].sort(compareBigInts);
  prime.replaceChildren(...choices.map(item => {
    const option = element('option', displayInteger(item));
    option.value = String(item);
    return option;
  }));
  prime.value = choices.some(item => String(item) === selected) ? selected : String(factors[0]?.prime ?? 2n);
}

function evaluate() {
  const raw = integer.value.trim();
  const n = /^\d{1,10}$/.test(raw) ? BigInt(raw) : 0n;
  const invalidInteger = n < 1n || n > maxInteger;
  const settings = active.parameter;
  const k = settings ? Number(parameter.value) : undefined;
  const invalidParameter = Boolean(settings &&
    (parameter.value === '' || !Number.isInteger(k) || k < settings.min || k > settings.max));
  integer.setAttribute('aria-invalid', String(invalidInteger));
  parameter.setAttribute('aria-invalid', String(invalidParameter));
  const message = byId('input-message');
  const invalid = invalidInteger || invalidParameter;
  message.hidden = !invalid;
  byId('result').hidden = invalid;
  seriesPanel.hidden = invalid;
  verification.hidden = invalid;
  if (invalid) {
    message.textContent = invalidInteger
      ? 'Enter a whole number from 1 to ' + displayInteger(maxInteger) + '.'
      : 'Enter an integer parameter from ' + settings.min + ' to ' + settings.max + '.';
    calculation = undefined;
    return;
  }
  calculation = {n, k, ...evaluateConvolution(active, n, k, swapped)};
  const {factors, value, inverseValue} = calculation;
  byId('value-label').textContent = 'f(' + displayInteger(n) + ')';
  byId('inverse-label').textContent = 'f⁻¹(' + displayInteger(n) + ')';
  byId('value').textContent = displayInteger(value);
  byId('inverse-value').textContent = displayInteger(inverseValue);
  const powers = factors.map(({prime: p, exponent}) => displayInteger(p) + (exponent === 1 ? '' : superscript(exponent)));
  byId('factorization').textContent = powers.length ? displayInteger(n) + ' = ' + powers.join(' × ') : 'At n = 1 both values are 1.';
  const local = factors.map(({inverseValues, exponent}) => inverseValues[exponent]);
  const localProduct = local.map(value => value < 0n ? '(' + displayInteger(value) + ')' : displayInteger(value)).join(' × ');
  byId('inverse-factors').textContent = powers.length > 1
    ? 'f⁻¹(' + displayInteger(n) + ') = ' + powers.map(power => 'f⁻¹(' + power + ')').join(' × ')
      + ' = ' + localProduct + ' = ' + displayInteger(inverseValue)
    : '';
  updatePrimes(factors);
  renderSeries();
  renderVerification();
}

for (const group of [...new Set(catalog.map(entry => entry.category))]) {
  const option = element('option', group);
  option.value = group;
  category.append(option);
}
search.addEventListener('input', renderCatalog);
category.addEventListener('change', renderCatalog);
rows.addEventListener('click', event => {
  const button = event.target.closest('button[data-function]');
  if (!button) return;
  selectEntry(entriesById.get(button.dataset.function));
  if (window.matchMedia('(max-width: 830px)').matches) title.focus();
});
byId('integer-form').addEventListener('submit', event => {
  event.preventDefault();
  evaluate();
});
parameter.addEventListener('change', evaluate);
prime.addEventListener('change', renderSeries);
invert.addEventListener('click', () => {
  revealed = !revealed;
  renderSeries();
});
swap.addEventListener('click', () => {
  swapped = !swapped;
  revealed = true;
  updateTitle();
  evaluate();
});
verification.addEventListener('toggle', renderVerification);
renderCatalog();
selectEntry(active);
search.disabled = false;
category.disabled = false;
for (const {button} of catalogRows) button.disabled = false;
byId('startup-note').hidden = true;
byId('calculator').hidden = false;
