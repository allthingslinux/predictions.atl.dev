import { parse } from 'csv-parse/sync';

interface InfluxConfig {
  apiToken: string;
  url: string;
  orgId: string;
}

export async function influxDBRequest(config?: InfluxConfig): Promise<string> {
  // If config is not provided, fall back to static env imports (for local dev)
  let apiToken: string, url: string, orgId: string;
  
  if (config) {
    apiToken = config.apiToken;
    url = config.url;
    orgId = config.orgId;
  } else {
    // Dynamic import for local development
    const { INFLUX_API_TOKEN, INFLUX_URL, INFLUX_ORG_ID } = await import('$env/static/private');
    apiToken = INFLUX_API_TOKEN;
    url = INFLUX_URL;
    orgId = INFLUX_ORG_ID;
  }

  try {
    const queryUrl = `${url}/api/v2/query?orgID=${orgId}`;

    // Fixed Flux query for Discord guild total users
    // Gets all data points, if we have this for longer than 1000 days god help us
    const fluxQuery = `from(bucket: "stats-backend")
  |> range(start: -7d, stop: now())
  |> filter(fn: (r) =>
    r._measurement == "discord_metrics" and
    r._field == "guild_total_users" and
    r.server == "1172245377395728464"
  )`;

    const response = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.flux',
        'User-Agent': 'insomnium/0.2.3-a',
        Accept: 'application/csv',
        Authorization: `Token ${apiToken}`
      },
      body: fluxQuery
    });

    if (!response.ok) {
      throw new Error(`InfluxDB query failed: ${response.status} ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    console.error('Error querying InfluxDB:', error);
    throw error;
  }
}

/*
example response piece:
0,result,table,_start,_stop,_time,_value,_field,_measurement,server
...
,_result,0,2025-04-23T00:41:44.827478673Z,2025-04-30T00:41:44.827478673Z,2025-04-30T00:40:18.556Z,8611,guild_total_users,discord_metrics,1172245377395728464
this function will parse the response csv and return an array of numbers and dates
*/
export function parseInfluxResponse(response: string): { date: Date; value: number }[] {
  const records = parse(response, {
    columns: true,
    skip_empty_lines: true
  });

  return records.map((record: { _time: string | number | Date; _value: string }) => ({
    date: new Date(record._time),
    value: parseFloat(record._value)
  }));
}

export function averageDataIntervals(
  data: { date: Date; value: number }[],
  intervalMinutes: number
): { date: Date; value: number }[] {
  if (!data.length) return [];

  // Convert interval from minutes to milliseconds
  const intervalMs = intervalMinutes * 60 * 1000;
  const intervalMap = new Map<string, { sum: number; count: number; timestamp: number }>();

  // Sort data by date (oldest first)
  const sortedData = [...data].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Group data points into time buckets
  sortedData.forEach((point) => {
    const timestamp = point.date.getTime();
    // Calculate which interval bucket this point belongs to
    const intervalStart = Math.floor(timestamp / intervalMs) * intervalMs;
    const key = intervalStart.toString();

    if (!intervalMap.has(key)) {
      intervalMap.set(key, { sum: 0, count: 0, timestamp: intervalStart });
    }

    const entry = intervalMap.get(key)!;
    entry.sum += point.value;
    entry.count++;
  });

  // Convert map to array and calculate averages
  const averagedData: { date: Date; value: number }[] = [];
  intervalMap.forEach((entry, _) => {
    averagedData.push({
      date: new Date(entry.timestamp),
      value: Math.round(entry.sum / entry.count)
    });
  });

  // Sort by date
  return averagedData.sort((a, b) => a.date.getTime() - b.date.getTime());
}
