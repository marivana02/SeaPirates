import { check, sleep } from 'k6';
import http from 'k6/http';
import { SharedArray } from 'k6/data';
import { Rate, Trend, Counter } from 'k6/metrics';

const attackFailRate = new Rate('attack_failures');
const attackDuration = new Trend('attack_duration');
const ongoingCount = new Counter('ongoing_attacks');
const wonCount = new Counter('won_fights');
const lostCount = new Counter('lost_fights');
const rateLimited = new Counter('rate_limited');
const fightStarts = new Counter('fight_starts');
const noFight = new Counter('no_fight_errors');

const tokens = new SharedArray('tokens', function () {
  const data = JSON.parse(open('./loadtest_tokens.json'));
  return data.map(u => ({ token: u.token, username: u.username }));
});

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '30s', target: 20 },
    { duration: '1m', target: 30 },
    { duration: '1m', target: 40 },
    { duration: '2m', target: 50 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
  },
  noConnectionReuse: false,
};

function getHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Requested-With': 'XMLHttpRequest',
  };
}

export default function () {
  const idx = (__VU - 1) % tokens.length;
  const user = tokens[idx];
  const headers = getHeaders(user.token);

  // Attack
  const payload = JSON.stringify({ ammoId: 1 });
  const res = http.post('http://localhost:3000/api/combat/attack', payload, {
    headers,
    timeout: '15s',
    tags: { endpoint: 'attack' },
  });

  attackDuration.add(res.timings.duration);

  if (res.status === 429) {
    rateLimited.add(1);
    attackFailRate.add(1);
    sleep(1);
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    attackFailRate.add(1);
    sleep(0.5);
    return;
  }

  const isAttack = check(res, {
    'valid attack response': () => {
      if (res.status !== 200) return false;
      return ['ongoing', 'won', 'lost'].includes(parsed.state);
    },
  });

  if (isAttack) {
    attackFailRate.add(0);

    if (parsed.state === 'ongoing') {
      ongoingCount.add(1);
    } else if (parsed.state === 'won') {
      wonCount.add(1);
      // Restart fight after winning
      sleep(0.2);
      const startRes = http.post('http://localhost:3000/api/combat/start',
        JSON.stringify({ mapLevel: 7, npcName: 'Flyingdutchman' }),
        { headers, timeout: '15s', tags: { endpoint: 'start' } }
      );
      if (startRes.status === 200) {
        fightStarts.add(1);
      }
    } else if (parsed.state === 'lost') {
      lostCount.add(1);
      // Wait and restart
      sleep(0.5);
      const startRes = http.post('http://localhost:3000/api/combat/start',
        JSON.stringify({ mapLevel: 7, npcName: 'Flyingdutchman' }),
        { headers, timeout: '15s', tags: { endpoint: 'start' } }
      );
      if (startRes.status === 200) {
        fightStarts.add(1);
      }
    }
  } else {
    attackFailRate.add(1);
    if (parsed.error?.includes('No active fight')) {
      noFight.add(1);
      // Restart fight
      sleep(0.3);
      const startRes = http.post('http://localhost:3000/api/combat/start',
        JSON.stringify({ mapLevel: 7, npcName: 'Flyingdutchman' }),
        { headers, timeout: '15s', tags: { endpoint: 'start' } }
      );
      if (startRes.status === 200) {
        fightStarts.add(1);
      }
    }
  }

  // Random sleep 300-700ms between attacks
  sleep(0.3 + Math.random() * 0.4);
}
