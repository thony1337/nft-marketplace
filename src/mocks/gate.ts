import { delay, http, HttpResponse } from 'msw';
import { apiError } from './http';
import { activeScenario, nextLatency } from './scenarios';

// First handler in the list: applies the active scenario's latency and failures to every
// API call. Returning nothing lets the request fall through to the real handler.
export const scenarioGate = http.all('/api/*', async ({ request }) => {
  const scenario = activeScenario();

  if (scenario.latency === 'infinite') {
    await delay('infinite');
  } else {
    const ms = nextLatency(scenario.latency);
    if (ms > 0) await delay(ms);
  }

  if (scenario.offline) return HttpResponse.error();

  const { pathname } = new URL(request.url);
  const failing = scenario.failing?.find(
    (rule) => rule.method === request.method && new RegExp(rule.path).test(pathname),
  );
  if (failing) return apiError(failing.status, failing.code, failing.message);

  return undefined;
});