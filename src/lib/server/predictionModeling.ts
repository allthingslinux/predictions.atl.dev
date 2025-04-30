export function linearRegression(data: { date: Date; value: number }[]) {
  if (data.length < 2) {
    throw new Error('At least two data points are required for linear regression');
  }

  // Convert dates to numerical values (milliseconds since epoch)
  const xArray = data.map((point) => point.date.getTime());
  const yArray = data.map((point) => point.value);

  // Calculate sums needed for linear regression
  let xSum = 0,
    ySum = 0,
    xxSum = 0,
    xySum = 0;
  const count = data.length;

  for (let i = 0; i < count; i++) {
    xSum += xArray[i];
    ySum += yArray[i];
    xxSum += xArray[i] * xArray[i];
    xySum += xArray[i] * yArray[i];
  }

  // Calculate slope and intercept
  const slope = (count * xySum - xSum * ySum) / (count * xxSum - xSum * xSum);
  const intercept = ySum / count - (slope * xSum) / count;

  // Calculate R-squared (coefficient of determination)
  const yMean = ySum / count;
  let totalVariation = 0;
  let explainedVariation = 0;

  for (let i = 0; i < count; i++) {
    const predicted = xArray[i] * slope + intercept;
    totalVariation += Math.pow(yArray[i] - yMean, 2);
    explainedVariation += Math.pow(predicted - yMean, 2);
  }

  const rSquared = explainedVariation / totalVariation;

  return {
    slope,
    intercept,
    rSquared,

    /**
     * Predicts a value at a specific date based on the regression model
     * @param date Date to predict value for
     * @returns Predicted value
     */
    predict: (date: Date): number => {
      const x = date.getTime();
      return x * slope + intercept;
    },

    /**
     * Generates predictions for a specified number of days in the future
     * @param days Number of days to predict forward
     * @param interval Interval between predictions in hours (default: 24)
     * @returns Array of predicted points with date and value
     */
    predictFuture: (days: number, interval = 24): { date: Date; value: number }[] => {
      const predictions = [];
      // Use the latest date in the dataset as starting point
      const latestDate = new Date(Math.max(...xArray));

      for (let i = 0; i < (days * 24) / interval; i++) {
        const futureDate = new Date(latestDate.getTime() + i * interval * 60 * 60 * 1000);
        const predictedValue = futureDate.getTime() * slope + intercept;
        predictions.push({
          date: futureDate,
          value: Math.round(predictedValue) // Round to whole numbers for user counts
        });
      }

      return predictions;
    }
  };
}

export function predictDiscordGrowth(data: { date: Date; value: number }[], daysToPredict = 30) {
  const model = linearRegression(data);

  return {
    currentUsers: data[data.length - 1].value,
    predictions: model.predictFuture(daysToPredict),
    modelFit: {
      rSquared: model.rSquared,
      slope: model.slope,
      intercept: model.intercept
    },
    // Calculate daily growth rate based on slope
    dailyGrowthRate: (model.slope * 24 * 60 * 60 * 1000) / data[data.length - 1].value
  };
}
