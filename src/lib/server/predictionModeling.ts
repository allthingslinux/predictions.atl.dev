import {
  linearRegression as ssLinearRegression,
  linearRegressionLine,
  rSquared
} from 'simple-statistics';

export function linearRegression(data: { date: Date; value: number }[]) {
  if (data.length < 2) {
    throw new Error('At least two data points are required for linear regression');
  }

  const dataLength = data.length;
  const xArray = data.map((point) => point.date.getTime());
  const yArray = data.map((point) => point.value);
  // Transform y-values to their natural logarithm. Add 1 to handle potential zeros.
  const logYArray = data.map((point) => Math.log(Math.max(1, point.value)));

  // Create original log points (for R-squared calculation)
  const originalLogPoints = xArray.map((x, i) => [x, logYArray[i]]);

  // --- Create WEIGHTED log points ---
  const weightedLogPoints: number[][] = [];
  for (let i = 0; i < dataLength; i++) {
    // Apply squared weight: (i + 1)^2
    const weight = Math.pow(i + 1, 2);

     // Duplicate the log point based on its weight
     for (let j = 0; j < weight; j++) {
       if (weightedLogPoints.length > 1000000) { // Safety limit
           console.warn("Weighted points array growing too large, stopping duplication for this point.");
           break;
       }
       weightedLogPoints.push([xArray[i], logYArray[i]]);
     }
  }


  // --- Perform linear regression on WEIGHTED log-transformed data ---
  let regression, slope, intercept, predictLogFn, rSquaredValue;

  if (weightedLogPoints.length > 1000000 || weightedLogPoints.length === 0) {
      console.warn("Weighted points exceed limit or is empty, falling back to unweighted log-linear regression.");
      // Fallback to unweighted
      regression = ssLinearRegression(originalLogPoints);
      slope = regression.m;
      intercept = regression.b;
      predictLogFn = linearRegressionLine(regression);
      rSquaredValue = rSquared(originalLogPoints, predictLogFn);
  } else {
      // Use weighted points
      regression = ssLinearRegression(weightedLogPoints);
      slope = regression.m;
      intercept = regression.b;
      predictLogFn = linearRegressionLine(regression);
      // Calculate R-squared based on how well the WEIGHTED model predicts the ORIGINAL log points
      rSquaredValue = rSquared(originalLogPoints, predictLogFn);
  }

  // Ensure R-squared is within valid range [0, 1]
  const finalRSquared = Math.max(0, Math.min(1, rSquaredValue));

  // Get the last actual value and its timestamp
  const lastActualValue = yArray[dataLength - 1];
  const lastTimestamp = xArray[dataLength - 1];

  return createModelResult(slope, intercept, finalRSquared, predictLogFn, xArray, lastTimestamp, lastActualValue);
}

// Helper function to create the return object, now includes offset calculation
function createModelResult(
    slope: number,
    intercept: number,
    rSquared: number,
    predictLogFn: (x: number) => number,
    xArray: number[],
    lastTimestamp: number,
    lastActualValue: number
) {

  // Calculate the model's prediction (in original scale) at the exact time of the last data point
  const logPredictionAtLastTimestamp = predictLogFn(lastTimestamp);
  const modelPredictionAtLastTimestamp = Math.exp(logPredictionAtLastTimestamp);

  // Calculate the offset needed to match the last actual value
  const offset = lastActualValue - modelPredictionAtLastTimestamp;

 return {
    slope: slope,
    intercept: intercept,
    rSquared: rSquared,

    predict: (date: Date): number => {
      const x = date.getTime();
      const logPrediction = predictLogFn(x);
      const rawPrediction = Math.exp(logPrediction);
      // Apply offset and ensure non-negative
      return Math.max(0, Math.round(rawPrediction + offset));
    },

    predictFuture: (days: number, interval = 24): { date: Date; value: number }[] => {
      const predictions = [];
      const latestDate = new Date(Math.max(...xArray));

      for (let i = 0; i < (days * 24) / interval; i++) {
        const futureDate = new Date(latestDate.getTime() + (i + 1) * interval * 60 * 60 * 1000);
        const x = futureDate.getTime();
        const logPrediction = predictLogFn(x);
        const rawPrediction = Math.exp(logPrediction);
        // Apply the calculated offset to shift the curve
        const finalValue = Math.max(0, Math.round(rawPrediction + offset));

        predictions.push({
          date: futureDate,
          value: finalValue
        });
      }
      return predictions;
    }
  };
}


// predictDiscordGrowth remains the same, growth rate is based on slope before offset
export function predictDiscordGrowth(data: { date: Date; value: number }[], daysToPredict = 30) {
  // Ensure data is sorted by date before processing
  const sortedData = [...data].sort((a, b) => a.date.getTime() - b.date.getTime());

  if (sortedData.length === 0) {
    return {
      currentUsers: 0,
      predictions: [],
      modelFit: { rSquared: 0, slope: 0, intercept: 0 },
      dailyGrowthRate: 0
    };
  }

  const model = linearRegression(sortedData); // This now returns the potentially weighted model
  const lastDataPointValue = sortedData[sortedData.length - 1].value;

  // Calculate daily growth rate based on the log-linear slope
  const msInDay = 24 * 60 * 60 * 1000;
  const dailyGrowthRate = Math.exp(model.slope * msInDay) - 1;

  return {
    currentUsers: lastDataPointValue,
    predictions: model.predictFuture(daysToPredict),
    modelFit: {
      rSquared: model.rSquared,
      slope: model.slope,
      intercept: model.intercept
    },
    dailyGrowthRate: dailyGrowthRate
  };
}