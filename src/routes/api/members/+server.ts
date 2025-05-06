import { json } from '@sveltejs/kit';
import { influxDBRequest, parseInfluxResponse, averageDataIntervals } from '$lib/server/influxUtils';

export async function GET() {
  try {
    const raw = await influxDBRequest();
    const data = averageDataIntervals(parseInfluxResponse(raw), 60);
    return json({ success: true, data });
  } catch (error) {
    console.error('Error in /api/members:', error);
    return json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}