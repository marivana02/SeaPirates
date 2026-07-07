const test = require('node:test');
const assert = require('node:assert/strict');

const { getRankBadge, rankNames } = require('../helpers/rank');
const { getPvPRank, PVP_RANKS } = require('../helpers/pvpRank');
const { getCurrentWeekString } = require('../helpers/date');

// ── Overall Rank Tests ──

test('getRankBadge keeps top player at badge 1', () => {
  assert.equal(getRankBadge(1, 200), 1);
});

test('getRankBadge returns badge 2 for positions 2-4 with 200 players', () => {
  assert.equal(getRankBadge(2, 200), 2);
  assert.equal(getRankBadge(3, 200), 2);
  assert.equal(getRankBadge(4, 200), 2);
});

test('getRankBadge returns badge 3 for positions 5-10 with 200 players', () => {
  assert.equal(getRankBadge(5, 200), 3);
  assert.equal(getRankBadge(10, 200), 3);
});

test('getRankBadge returns fallback badge for out-of-range positions', () => {
  assert.equal(getRankBadge(9999, 200), 13);
});

test('getRankBadge correctly distributes 110 players', () => {
  assert.equal(getRankBadge(76, 110), 12);  // last pos of badge 12
  assert.equal(getRankBadge(77, 110), 13);  // badge 13 starts
  assert.equal(getRankBadge(110, 110), 13); // last player → badge 13
});

test('getRankBadge gives rank 1=1, rank 2=3, rank 3=6 on small servers', () => {
  assert.equal(getRankBadge(1, 50), 1);
  assert.equal(getRankBadge(2, 50), 2);
  assert.equal(getRankBadge(4, 50), 2);
  assert.equal(getRankBadge(5, 50), 3);
  assert.equal(getRankBadge(10, 50), 3);
});

test('getRankBadge correctly distributes 500 players', () => {
  assert.equal(getRankBadge(317, 500), 12); // last pos of badge 12
  assert.equal(getRankBadge(318, 500), 13); // badge 13 starts
});

test('getRankBadge falls back to original thresholds for large servers', () => {
  // 1726+ uses original fixed thresholds: badge 13 starts at pos 1077
  assert.equal(getRankBadge(1076, 2000), 12);
  assert.equal(getRankBadge(1077, 2000), 13);
});

test('rankNames contains all 13 ranks', () => {
  assert.equal(Object.keys(rankNames).length, 13);
  for (let i = 1; i <= 13; i++) {
    assert.ok(rankNames[i], `Rank ${i} missing`);
    assert.ok(typeof rankNames[i].tr === 'string', `Rank ${i} TR name missing`);
    assert.ok(typeof rankNames[i].en === 'string', `Rank ${i} EN name missing`);
    assert.ok(typeof rankNames[i].key === 'string', `Rank ${i} key missing`);
  }
});

test('top rank has correct name', () => {
  assert.equal(rankNames[1].tr, 'Denizlerin Hükümdarı');
  assert.equal(rankNames[1].en, 'Ruler of the Seas');
  assert.equal(rankNames[1].key, 'rank_1');
});

test('bottom rank has correct name', () => {
  assert.equal(rankNames[13].tr, 'Kara Adamı');
  assert.equal(rankNames[13].en, 'Sailor');
  assert.equal(rankNames[13].key, 'rank_13');
});

// ── PvP Rank Tests ──

test('getPvPRank returns unranked for zero points', () => {
  const rank = getPvPRank(0);
  assert.equal(rank.name, null);
  assert.equal(rank.badge, null);
});

test('getPvPRank returns unranked for negative points', () => {
  const rank = getPvPRank(-5);
  assert.equal(rank.name, null);
  assert.equal(rank.badge, null);
});

test('getPvPRank returns first rank at threshold', () => {
  const rank = getPvPRank(1);
  assert.equal(rank.name, 'Tayfa');
  assert.equal(rank.badge, 'badge_01');
});

test('getPvPRank returns correct rank at mid threshold', () => {
  const rank = getPvPRank(450);
  assert.equal(rank.name, 'Kıdemli Gemici');
  assert.equal(rank.badge, 'badge_04');
});

test('getPvPRank returns correct rank at upper threshold', () => {
  const rank = getPvPRank(16300);
  assert.equal(rank.name, 'Korsan Kralı');
  assert.equal(rank.badge, 'badge_23');
});

test('getPvPRank returns max rank at highest threshold', () => {
  const rank = getPvPRank(113000);
  assert.equal(rank.name, 'SeaPirate İlahı');
  assert.equal(rank.badge, 'badge_60');
});

test('getPvPRank includes next rank info', () => {
  const rank = getPvPRank(100);
  assert.equal(rank.nextName, 'Gemici');
  assert.equal(rank.nextBadge, 'badge_03');
});

test('getPvPRank has correct max value at top rank', () => {
  const rank = getPvPRank(113000);
  assert.equal(rank.max, 9999999);
});

test('PVP_RANKS has correct number of entries', () => {
  assert.ok(PVP_RANKS.length >= 40, 'PVP_RANKS should have at least 40 entries');
  assert.ok(PVP_RANKS.length <= 50, 'PVP_RANKS should have at most 50 entries');
});

test('PVP_RANKS are ordered by increasing min threshold', () => {
  for (let i = 1; i < PVP_RANKS.length; i++) {
    assert.ok(PVP_RANKS[i].min > PVP_RANKS[i - 1].min,
      `${PVP_RANKS[i].name} min not > ${PVP_RANKS[i - 1].name} min`);
  }
});

test('PVP_RANKS all have name, badge, min fields', () => {
  for (const rank of PVP_RANKS) {
    assert.ok(typeof rank.name === 'string', `Missing name for ${rank.badge}`);
    assert.ok(typeof rank.badge === 'string', `Missing badge for ${rank.name}`);
    assert.ok(typeof rank.min === 'number' && rank.min >= 0, `Invalid min for ${rank.name}`);
  }
});

// ── Date Tests ──

test('getCurrentWeekString returns ISO-like week format', () => {
  const week = getCurrentWeekString();
  assert.match(week, /^\d{4}-W\d{2}$/);
});

test('getCurrentWeekString year component is valid', () => {
  const week = getCurrentWeekString();
  const year = parseInt(week.split('-')[0]);
  assert.ok(year >= 2020 && year <= 2050, `Year ${year} out of range`);
});

test('getCurrentWeekString week number is 1-53', () => {
  const week = getCurrentWeekString();
  const weekNum = parseInt(week.split('W')[1]);
  assert.ok(weekNum >= 1 && weekNum <= 53, `Week ${weekNum} out of range`);
});
