// Runs the compiled client-side engine (frontend/app/services/engine) over the cases
// written by check_static_parity.py and writes its outputs next to them.
// Usage: node run_engine.cjs <compiled-engine-dir> <data-dir> <cases.json> <out.json>

const fs = require('fs');
const path = require('path');

const [engineDir, dataDir, casesPath, outPath] = process.argv.slice(2);
const load = (name) => require(path.resolve(engineDir, name));
const { indexStandards, indexWeightings, indexAtar } = load('dataset.js');
const { ATARCalculator } = load('atar-engine.js');
const search = load('search.js');
const fuzz = load('fuzz.js');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const standards = indexStandards(readJson(path.join(dataDir, 'standards.json')));
const weightings = indexWeightings(readJson(path.join(dataDir, 'weightings.json')));
const atar = indexAtar(readJson(path.join(dataDir, 'atar.json')));

// The histogram binning ATARResults.tsx used to do on the full API distribution.
function legacyHistogram(distribution) {
  const binSize = 0.005;
  const bins = new Map();
  const values = distribution.map((d) => d.statistical_value);
  for (const point of distribution) {
    const binKey = Math.floor(point.statistical_value / binSize) * binSize;
    bins.set(binKey, (bins.get(binKey) || 0) + point.frequency);
  }
  return {
    bins: Array.from(bins.entries()).map(([value, freq]) => ({ value, freq })).sort((a, b) => a.value - b.value),
    min_value: Math.min(...values),
    max_value: Math.max(...values),
    total_frequency: distribution.reduce((sum, d) => sum + d.frequency, 0),
  };
}

function run(c) {
  try {
    switch (c.kind) {
      case 'calculate': {
        if (!c.input.length) return { error: 400 };
        const results = new ATARCalculator(c.input, standards, weightings, atar).calculateForAllYears();
        return results.length ? { results } : { error: 404 };
      }
      case 'breakdown': {
        if (!c.input.length) return { error: 400 };
        const b = new ATARCalculator(c.input, standards, weightings, atar).calculateBreakdown();
        return b.years.length ? b : { error: 404 };
      }
      case 'suggestions':
        return search.getSuggestions(standards, c.input);
      case 'search':
        return search.searchStandards(standards, c.input);
      case 'years':
        return { standard_number: c.input.standard_number, version: c.input.version,
          available_years: search.getAvailableYears(weightings, c.input.standard_number, c.input.version) };
      case 'versions':
        return { standard_number: c.input, available_versions: search.getAvailableVersions(weightings, c.input) };
      case 'distribution': {
        const data = atar.years.get(c.input.year);
        if (!data) return { error: 404 };
        return {
          engine: {
            bins: data.histogram.bins.map(([value, freq]) => ({ value, freq })),
            min_value: data.histogram.min_value,
            max_value: data.histogram.max_value,
            total_frequency: data.histogram.total_frequency,
            weighted_statnz_population: data.weighted_statnz_population,
            nz_total_candidature: data.nz_total_candidature,
            participation_rate: data.participation_rate,
          },
          legacy: legacyHistogram(c.input.distribution),
        };
      }
      case 'wratio': {
        // Same pre-processing extractOne applies, then the raw float score.
        const q = fuzz.fullProcess(fuzz.fullProcess(c.input.query), true);
        return c.input.choices.map((choice) => fuzz.WRatio(q, fuzz.fullProcess(choice, true)));
      }
      default:
        throw new Error(`unknown case kind ${c.kind}`);
    }
  } catch (err) {
    return { exception: String(err && err.stack || err) };
  }
}

const cases = readJson(casesPath);
const started = process.hrtime.bigint();
const perKindMs = {};
const outputs = cases.map((c) => {
  const t0 = process.hrtime.bigint();
  const out = run(c);
  perKindMs[c.kind] = (perKindMs[c.kind] || 0) + Number(process.hrtime.bigint() - t0) / 1e6;
  return out;
});
const ms = Number(process.hrtime.bigint() - started) / 1e6;
fs.writeFileSync(outPath, JSON.stringify({ outputs, ms, perKindMs }));
