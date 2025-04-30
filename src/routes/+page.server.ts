import {
  averageDataIntervals,
  influxDBRequest,
  parseInfluxResponse
} from '$lib/server/influxUtils';
import { predictDiscordGrowth } from '$lib/server/predictionModeling';
import type { PageServerLoad } from './$types';

export const load = (async () => {
  try {
    const rawResponse = await influxDBRequest();
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
