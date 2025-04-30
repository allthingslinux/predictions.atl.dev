<script lang="ts">
  import type { PageData } from './$types';
  import { onMount } from 'svelte';
  import Chart from 'chart.js/auto';
  import 'chartjs-adapter-date-fns';
  import annotationPlugin from 'chartjs-plugin-annotation';
  import type { ChartTypeRegistry } from 'chart.js';

  Chart.register(annotationPlugin);

  export let data: PageData;
  const { discordStats } = data;

  let historicalChartCanvas: HTMLCanvasElement;
  let combinedChartCanvas: HTMLCanvasElement;
  let historicalChart: Chart<keyof ChartTypeRegistry, { x: Date; y: number }[]>;
  let combinedChart: Chart<keyof ChartTypeRegistry, { x: Date; y: number }[]>;
  let milestones: { title: string; num: number }[] = [];

  // Format helpers
  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  const formatPredictionDate = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const formatPercent = (value: number) => (value * 100).toFixed(2) + '%';

  // Data processing
  const values = discordStats.data?.map((d) => d.value) || [];
  const maxValue = Math.max(...values, 0);
  const minValue = Math.min(...values, 0);
  $: predictions = discordStats.predictions?.predictions || [];
  $: modelFit = discordStats.predictions?.modelFit || { rSquared: 0 };
  $: growthRate = discordStats.predictions?.dailyGrowthRate || 0;
  $: predictionDays = predictions.length || 0;
  $: weekIndex = Math.min(7, predictionDays - 1);
  $: endIndex = Math.max(0, predictionDays - 1);

  // Define interfaces for milestone types
  interface Milestone {
    title: string;
    num: number;
  }

  interface MilestoneWithDate extends Milestone {
    date: Date;
    daysFromNow: number;
  }

  // Get milestone dates based on predictions
  function getMilestoneDates(): MilestoneWithDate[] {
    if (!milestones.length || !predictions.length) return [];

    const currentValue = discordStats.data[discordStats.data.length - 1].value;

    // Use a regular array instead of map+filter for better type safety
    const result: MilestoneWithDate[] = [];

    for (const milestone of milestones) {
      if (milestone.num <= currentValue) continue;

      const prediction = predictions.find((p) => p.value >= milestone.num);
      if (!prediction) continue;

      result.push({
        ...milestone,
        date: prediction.date,
        daysFromNow: Math.round(
          (prediction.date.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000)
        )
      });
    }

    return result;
  }

  // Fix the TypeScript error with onMount by separating async logic from cleanup
  onMount(() => {
    // Define the initialization function
    const initialize = async () => {
      // Load milestones
      try {
        const res = await fetch('/milestones.json');
        milestones = await res.json();
        console.log('Loaded milestones:', milestones);
      } catch (err) {
        console.error('Failed to load milestones:', err);
        milestones = [];
      }

      const maxMilestone = Math.ceil(maxValue / 1000) * 1000;
      const milestone = maxMilestone + 1000;
      if (!milestones.some((m) => m.num === milestone)) {
        milestones.push({ title: `${milestone}`, num: milestone });
      }

      if (!discordStats.success || discordStats.data.length === 0) return;

      // Initialize charts
      historicalChart = new Chart(historicalChartCanvas, {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'Discord Users',
              data: discordStats.data.map((point) => ({ x: point.date, y: point.value })),
              borderColor: 'rgb(59, 130, 246)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              fill: true,
              tension: 0.2,
              pointRadius: 1,
              pointHoverRadius: 16,
              borderWidth: 3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Historical Data (All Time)',
              font: { size: 18, weight: 'bold' }
            },
            legend: { display: true },
            tooltip: {
              titleFont: { size: 16 },
              bodyFont: { size: 14 },
              callbacks: { title: (context) => formatDate(new Date(context[0].parsed.x)) }
            }
          },
          scales: {
            x: {
              type: 'time',
              time: { unit: 'day', displayFormats: { day: 'MMM d' } },
              title: { display: true, text: 'Date', font: { size: 14 } }
            },
            y: {
              beginAtZero: false,
              title: { display: true, text: 'Users', font: { size: 14 } },
              grid: { display: true }
            }
          },
          interaction: {
            mode: 'nearest',
            intersect: false,
            axis: 'x'
          }
        }
      });

      // Create milestone annotations for the chart
      const milestoneAnnotations: { [key: string]: any } = {};

      // Only add annotations if we have milestones
      if (milestones.length > 0) {
        milestones.forEach((milestone, index) => {
          if (milestone.num > discordStats.data[discordStats.data.length - 1].value) {
            milestoneAnnotations[`line${index}`] = {
              type: 'line',
              yMin: milestone.num,
              yMax: milestone.num,
              borderColor: 'rgba(255, 99, 132, 0.8)',
              borderWidth: 2,
              borderDash: [5, 5],
              label: {
                display: true,
                content: milestone.title,
                position: 'end',
                font: { size: 14, weight: 'bold' },
                backgroundColor: 'rgba(255, 99, 132, 0.8)',
                color: 'white',
                padding: 8
              }
            };
          }
        });
      }

      // Combined chart with milestone annotations
      combinedChart = new Chart(combinedChartCanvas, {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'Historical',
              data: discordStats.data.map((point) => ({ x: point.date, y: point.value })),
              borderColor: 'rgb(59, 130, 246)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              fill: false,
              tension: 0.2,
              pointRadius: 1,
              pointHoverRadius: 16,
              borderWidth: 3
            },
            {
              label: 'Predictions',
              data: predictions.map((point) => ({ x: point.date, y: point.value })),
              borderColor: 'rgb(34, 197, 94)',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              borderDash: [5, 5],
              fill: false,
              tension: 0,
              pointRadius: 1,
              pointHoverRadius: 16,
              borderWidth: 2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: `Projection (${predictionDays} Days)`,
              font: { size: 18, weight: 'bold' }
            },
            tooltip: {
              titleFont: { size: 16 },
              bodyFont: { size: 14 },
              callbacks: { title: (context) => formatDate(new Date(context[0].parsed.x)) }
            },
            annotation: {
              annotations: milestoneAnnotations
            }
          },
          scales: {
            x: {
              type: 'time',
              time: { unit: 'day', displayFormats: { day: 'MMM d' } },
              title: { display: true, text: 'Date', font: { size: 14 } }
            },
            y: {
              beginAtZero: false,
              title: { display: true, text: 'Users', font: { size: 14 } },
              grid: { display: true }
            }
          },
          interaction: {
            mode: 'nearest',
            intersect: false,
            axis: 'x'
          }
        }
      });

      // Force update milestoneDates after charts are initialized
      milestoneDates = getMilestoneDates();
    };

    // Start initialization but don't wait for it
    initialize();

    // Return cleanup function directly (not wrapped in Promise)
    return () => {
      historicalChart?.destroy();
      combinedChart?.destroy();
    };
  });

  $: milestoneDates = getMilestoneDates();
</script>

<div class="mx-auto max-w-6xl p-6">
  <h1 class="mb-6 text-3xl font-bold">Discord User Growth</h1>

  {#if !discordStats.success}
    <div class="mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
      Error loading data: {discordStats.error || 'Unknown error'}
    </div>
  {:else if discordStats.data.length === 0}
    <div class="mb-4 rounded border border-yellow-400 bg-yellow-100 px-4 py-3 text-yellow-700">
      No data available
    </div>
  {:else}
    <!-- Stats summary -->
    <div class="mb-6 grid grid-cols-5 gap-4 text-center">
      <div class="rounded bg-blue-50 p-4 shadow">
        <h3 class="text-xs font-semibold text-blue-500 uppercase">Current Users</h3>
        <p class="text-2xl font-bold">{discordStats.data[discordStats.data.length - 1].value}</p>
      </div>
      <div class="rounded bg-green-50 p-4 shadow">
        <h3 class="text-xs font-semibold text-green-500 uppercase">Daily Growth</h3>
        <p class="text-2xl font-bold">{formatPercent(growthRate)}</p>
      </div>
      <div class="rounded bg-purple-50 p-4 shadow">
        <h3 class="text-xs font-semibold text-purple-500 uppercase">Accuracy (R²)*</h3>
        <p class="text-2xl font-bold">{formatPercent(modelFit.rSquared)}</p>
      </div>
      <div class="rounded bg-yellow-50 p-4 shadow">
        <h3 class="text-xs font-semibold text-yellow-500 uppercase">Milestones</h3>
        <p class="text-2xl font-bold">
          {milestones.length} milestone{milestones.length > 1 ? 's' : ''}
        </p>
      </div>
      {#if milestoneDates.length > 0}
        <div class="rounded bg-orange-50 p-4 shadow">
          <h3 class="text-xs font-semibold text-orange-500 uppercase">Milestone Time</h3>
          <p class="text-2xl font-bold">
            {milestoneDates[0].daysFromNow} days
          </p>
        </div>
      {/if}
    </div>

    <!-- Charts - side by side on larger screens -->
    <div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
      <div class="rounded-lg bg-white p-5 shadow">
        <div class="h-72">
          <canvas bind:this={historicalChartCanvas}></canvas>
        </div>
      </div>
      <div class="rounded-lg bg-white p-5 shadow">
        <div class="h-72">
          <canvas bind:this={combinedChartCanvas}></canvas>
        </div>
      </div>
    </div>

    <!-- Milestones section -->
    {#if milestoneDates.length > 0}
      <div class="mb-6 rounded-lg bg-yellow-50 p-5 shadow">
        <h2 class="mb-3 text-xl font-bold">Upcoming Milestones</h2>
        <div class="flex flex-wrap gap-4">
          {#each milestoneDates as milestone}
            <div class="rounded bg-white p-4 shadow">
              <div class="text-lg font-semibold text-amber-600">{milestone.title}</div>
              <div class="text-base">
                ~{formatPredictionDate(milestone.date)}
                <span class="text-gray-500">({milestone.daysFromNow} days)</span>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Prediction Summary -->
    <div class="mb-6 rounded-lg bg-white p-5 shadow">
      <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <h3 class="mb-2 text-base font-semibold text-gray-700">Current Status</h3>
          <p class="text-base">
            Current: <span class="font-bold"
              >{discordStats.data[discordStats.data.length - 1].value}</span
            >
          </p>
          <p class="text-base">
            Data Points: <span class="font-bold">{discordStats.data.length} measurements</span>
          </p>
          <p class="text-base">
            Peak: <span class="font-bold">{maxValue}</span>
          </p>
        </div>
        <div>
          <h3 class="mb-2 text-base font-semibold text-gray-700">Growth Projections</h3>
          {#if predictions.length > 0}
            <p class="text-base">
              7 days: <span class="font-bold">{predictions[weekIndex]?.value || 'N/A'}</span>
              <span class="ml-2 text-sm text-green-600">
                (+{formatPercent(
                  predictions[weekIndex].value /
                    discordStats.data[discordStats.data.length - 1].value -
                    1
                )})
              </span>
            </p>
            <p class="text-base">
              {predictionDays} days:
              <span class="font-bold">{predictions[endIndex]?.value || 'N/A'}</span>
              <span class="ml-2 text-sm text-green-600">
                (+{formatPercent(
                  predictions[endIndex].value /
                    discordStats.data[discordStats.data.length - 1].value -
                    1
                )})
              </span>
            </p>
          {/if}
        </div>
      </div>
    </div>

    <!-- Small methodology note -->
    <div class="text-sm text-gray-500">
      Sponsored by accuratelinuxgraphs.<br />
      *Based on linear regression (R²: {formatPercent(modelFit.rSquared)}). accuratelinuxgraphs does
      not guarantee 100% accuracy or even 50% accuracy due to external factors affecting Discord
      user growth.<br />TLDR: Not our fault if this is wrong. If it is, thats your fucking fault for
      not understanding this.
    </div>
  {/if}
</div>
