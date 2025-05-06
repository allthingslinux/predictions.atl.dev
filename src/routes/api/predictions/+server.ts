import { json } from '@sveltejs/kit';
import { influxDBRequest, parseInfluxResponse, averageDataIntervals } from '$lib/server/influxUtils';
import { predictDiscordGrowth } from '$lib/server/predictionModeling';

export async function GET({ url }) {
  try {
    const days = Number(url.searchParams.get('days')) || 30;
    const raw = await influxDBRequest();
    const data = averageDataIntervals(parseInfluxResponse(raw), 60);
    const result = predictDiscordGrowth(data, days);
    return json({ success: true, ...result });
  } catch (error) {
    console.error('Error in /api/predictions:', error);
    return json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}