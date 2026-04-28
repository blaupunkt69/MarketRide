const POINTS_BY_TIMEFRAME = {
  '5Y': 780,
  '1Y': 420,
  '1M': 260,
  '1W': 200,
};

const DEMO_BASE_BY_TIMEFRAME = {
  '5Y': 100,
  '1Y': 150,
  '1M': 80,
  '1W': 60,
};

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function movingAverage(series, window = 5) {
  const out = [];
  const half = Math.floor(window / 2);
  for (let i = 0; i < series.length; i += 1) {
    let sum = 0;
    let count = 0;
    for (let j = i - half; j <= i + half; j += 1) {
      const idx = Math.max(0, Math.min(series.length - 1, j));
      sum += series[idx];
      count += 1;
    }
    out.push(sum / count);
  }
  return out;
}

export function generateDemoSeries(symbol, timeframe) {
  const length = POINTS_BY_TIMEFRAME[timeframe] ?? 420;
  const seed = hashString(`${symbol.toUpperCase()}-${timeframe}`);
  const rand = mulberry32(seed);

  let price = DEMO_BASE_BY_TIMEFRAME[timeframe] ?? 100;
  const prices = [price];

  let regimeDrift = (rand() - 0.5) * 0.004;
  let regimeVol = 0.01 + rand() * 0.02;

  for (let i = 1; i < length; i += 1) {
    if (i % 45 === 0 || rand() < 0.04) {
      regimeDrift = (rand() - 0.45) * 0.006;
      regimeVol = 0.008 + rand() * 0.03;
    }

    const gaussianish = (rand() + rand() + rand() + rand() - 2) / 2;
    let shock = 0;
    if (rand() < 0.03) {
      shock = (rand() - 0.5) * 0.15;
    }

    const logReturn = regimeDrift + gaussianish * regimeVol + shock;
    price *= Math.exp(logReturn);
    price = Math.max(5, price);
    prices.push(price);
  }

  return movingAverage(prices, 5);
}

async function tryProxy(symbol, timeframe) {
  const res = await fetch(`/api/prices?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`);
  if (!res.ok) {
    throw new Error(`Proxy failed: ${res.status}`);
  }
  const payload = await res.json();
  if (!Array.isArray(payload?.prices) || payload.prices.length < 20) {
    throw new Error('Proxy payload invalid');
  }
  return payload.prices.map(Number).filter((n) => Number.isFinite(n) && n > 0);
}

async function tryStooq(symbol) {
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol.toLowerCase())}.us&i=d`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Stooq failed: ${res.status}`);
  }
  const csv = await res.text();
  const lines = csv.trim().split('\n').slice(1);
  const close = lines
    .map((line) => line.split(',')[4])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  if (close.length < 20) {
    throw new Error('Not enough live data');
  }
  return close;
}

function sliceByTimeframe(prices, timeframe) {
  const take = POINTS_BY_TIMEFRAME[timeframe] ?? 420;
  return prices.slice(Math.max(0, prices.length - take));
}

export async function getPriceSeries({ symbol, timeframe, source }) {
  const upper = symbol.toUpperCase().trim() || 'AAPL';
  const requestedSource = source || 'demo';

  if (requestedSource === 'live') {
    try {
      const proxied = await tryProxy(upper, timeframe);
      return { prices: sliceByTimeframe(proxied, timeframe), sourceUsed: 'live-proxy' };
    } catch (_) {
      try {
        const live = await tryStooq(upper);
        return { prices: sliceByTimeframe(live, timeframe), sourceUsed: 'live-public' };
      } catch {
        return {
          prices: generateDemoSeries(upper, timeframe),
          sourceUsed: 'demo-fallback',
        };
      }
    }
  }

  return { prices: generateDemoSeries(upper, timeframe), sourceUsed: 'demo' };
}

export function pricesToTerrain(prices, { width, height, difficultyMultiplier = 1 }) {
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = Math.max(1e-6, max - min);
  const topPad = height * 0.14;
  const bottomPad = height * 0.2;
  const usable = height - topPad - bottomPad;
  const xStep = width / (prices.length - 1);

  const normalized = prices.map((price) => (price - min) / span);
  const smooth = movingAverage(normalized, 7);
  const center = smooth.reduce((a, b) => a + b, 0) / smooth.length;

  const terrain = smooth.map((value, i) => {
    const amplified = Math.min(1, Math.max(0, center + (value - center) * difficultyMultiplier));
    return {
      x: i * xStep,
      y: topPad + (1 - amplified) * usable,
    };
  });

  return terrain;
}
