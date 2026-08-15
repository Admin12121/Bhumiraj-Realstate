import http from "k6/http";
import { check, sleep } from "k6";
export const options = { scenarios: { bids: { executor: "per-vu-iterations", vus: Number(__ENV.VUS || 100), iterations: 1, maxDuration: "2m" } }, thresholds: { http_req_failed: ["rate<0.05"], http_req_duration: ["p(95)<1500"] } };
export default function () {
  const auctionId = __ENV.AUCTION_ID;
  const token = __ENV.SESSION_COOKIE;
  const amount = Number(__ENV.BASE_AMOUNT_MINOR || 10000000) + __VU * Number(__ENV.INCREMENT_MINOR || 100000);
  const response = http.post(`${__ENV.BASE_URL || "http://localhost"}/api/v1/auctions/${auctionId}/bids`, JSON.stringify({ amountMinor: String(amount) }), { headers: { "content-type": "application/json", cookie: token, "idempotency-key": `k6-${__VU}-${Date.now()}` } });
  check(response, { "accepted or business rejection": (r) => [200, 201, 409].includes(r.status) });
  sleep(0.1);
}
