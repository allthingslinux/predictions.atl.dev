import {
  averageDataIntervals,
  influxDBRequest,
  parseInfluxResponse
} from '$lib/server/influxUtils';
import { predictDiscordGrowth } from '$lib/server/predictionModeling';
import type { PageServerLoad } from './$types';

export const load = (async ({ platform }) => {
  try {
    let rawResponse: string;
    
    // Check if we're running on Cloudflare (platform.env exists)
    if (platform?.env) {
      // Running on Cloudflare Workers - use platform.env
      rawResponse = await influxDBRequest({
        apiToken: platform.env.INFLUX_API_TOKEN,
        url: platform.env.INFLUX_URL,
        orgId: platform.env.INFLUX_ORG_ID
      });
    } else {
      // Running locally - use default behavior (static imports)
      rawResponse = await influxDBRequest();
    }
    
    const parsedData = averageDataIntervals(parseInfluxResponse(rawResponse), 60);

    // Generate predictions for the next 90 days
    const predictions = predictDiscordGrowth(parsedData, 120);

    return {
      discordStats: {
        data: parsedData,
        success: true,
        predictions
      }
    };
  } catch (error) {
    console.error('Error loading Discord stats:', error);
    return {
      discordStats: {
        data: [],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}) satisfies PageServerLoad;
