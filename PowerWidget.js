// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: red; icon-glyph: magic;
"use strict";

let Logger = importModule("Logger.js");
let logger = new Logger(); //Create Logger object, with default setttings. Logs saved under the same name as the script

const hassUrl = "http://idontknow:8123" //External URL
const hassUrl2 = "http://youshouldknow:8123" //Internal URL

const hassToken = "your dirty secrets"
/* eslint-disable @typescript-eslint/no-magic-numbers */
const {
  createWidget
} = importModule("./tiny-dashboard");
const {
  numberFormatterShort
} = importModule("./utils");
const dateFormatter = new DateFormatter();
dateFormatter.useShortTimeStyle();
const SCRIPT_NAME = 'power-stat';

//const states = await fetchAllStates()
let chartDT = [];
const sensorData = {};

const Sensors = [
  "sensor.vue2_total_daily_energy",
  "sensor.vue2_total_power",
  "sensor.monthly_energy",
];

async function processData() {
  // Ensure sensorData is populated before proceeding
  await Promise.all(Sensors.map(async (sensor) => {
    const state = await fetchAllStates(sensor);
    sensorData[sensor] = state;
  }));
  logger.log("Sensor Data:");
  logger.log(sensorData);
  const history = await fetchHistory()
  logger.log("Stat history:");
  logger.log(history);
  chartDT = generateChartData(history);
  logger.exportLogs(false, undefined, true); 
  return exec();
}

async function exec() {
  const widget = createWidget({
    chartData: chartDT,
    subtitle1: `${numberFormatterShort(sensorData["sensor.vue2_total_daily_energy"]/1000)}Kwh OGGI / ${numberFormatterShort(sensorData["sensor.monthly_energy"])}Kwh MESE`,
    subtitle2: `UPDATED: ${dateFormatter.string(new Date())}`,
    value: `${sensorData["sensor.vue2_total_power"]}`,
    subValue: `W`,
    headerSymbol: 'bolt.fill',
    header: '  HOUSE POWER:'
  }, {
    dark: 'ash'
  });
  Script.setWidget(widget);
  return widget;
}

if (config.runsInApp) {
  const widget = await processData();
  await widget.presentSmall();
} else {
  await processData();
}

async function fetchAllStates(entityID) {
  try {
    let req = new Request(`${hassUrl}/api/states/${entityID}`);
    req.timeoutInterval = 6;
    req.headers = { 
      "Authorization": `Bearer ${hassToken}`, 
      "content-type": "application/json" 
    };
    const responseData = await req.loadJSON();
    return responseData.state; // Return only the state
  } catch (e) {
    let req = new Request(`${hassUrl2}/api/states/${entityID}`);
    req.timeoutInterval = 3;
    req.headers = { 
      "Authorization": `Bearer ${hassToken}`, 
      "content-type": "application/json" 
    };
    const responseData = await req.loadJSON();
    return responseData.state; // Return only the state
  }
}

async function fetchHistory() {
  const currentDate = new Date();
  // Subtract 2 hours from the current date and time
  currentDate.setHours(currentDate.getHours() - 2);
  // Format the date into the desired format
  const formattedTimestamp = currentDate.toISOString();
  try {
    let req = new Request(`${hassUrl}/api/history/period/${encodeURIComponent(formattedTimestamp)}?filter_entity_id=sensor.vue2_total_power&minimal_response`)
    req.timeoutInterval = 6;
    req.headers = { 
      "Authorization": `Bearer ${hassToken}`, 
      "content-type": "application/json"
    }
    return await req.loadJSON();
  } catch (e) {
    let req = new Request(`${hassUrl2}/api/history/period/${encodeURIComponent(formattedTimestamp)}?filter_entity_id=sensor.vue2_total_power&minimal_response`)
    req.timeoutInterval = 3;
    req.headers = { 
      "Authorization": `Bearer ${hassToken}`, 
      "content-type": "application/json"
    }
    return await req.loadJSON();
  }
}

function generateChartData(data) {
  // Extract the relevant data and filter out entries older than one hour
  const relevantData = data[0].filter(entry => {
      const timestamp = new Date(entry.last_changed).getTime();
      return Date.now() - timestamp <= 7300000; // One hour in milliseconds
  });

  // Sort relevant data by last_changed timestamp in ascending order
  relevantData.sort((a, b) => new Date(a.last_changed) - new Date(b.last_changed));

  // Replace null values with the average of adjacent non-null values
  for (let i = 0; i < relevantData.length; i++) {
      if (relevantData[i].state === null && i > 0 && i < relevantData.length - 1) {
          const prevValue = parseFloat(relevantData[i - 1].state);
          const nextValue = parseFloat(relevantData[i + 1].state);
          relevantData[i].state = (prevValue + nextValue) / 2;
      }
  }

  // Create a rolling window of 20 entries
  const chartData = [];
  const windowSize = 500;
  const interval = 7200000 / windowSize; // One hour in milliseconds divided by window size

  let currentIndex = relevantData.length - 1;
  let currentIntervalEnd = Date.now();
  let currentIntervalStart = currentIntervalEnd - interval;

  for (let i = 0; i < windowSize; i++) {
      let totalWeight = 0;
      let weightedSum = 0;

      // Calculate weighted sum for each time interval
      while (currentIndex >= 0) {
          const entry = relevantData[currentIndex];
          const timestamp = new Date(entry.last_changed).getTime();

          if (timestamp >= currentIntervalStart && timestamp < currentIntervalEnd) {
              const timeDifference = currentIntervalEnd - timestamp;
              const weight = Math.max(0, Math.min(1, 1 - (timeDifference / interval)));
              totalWeight += weight;
              weightedSum += parseFloat(entry.state) * weight;
              currentIndex--;
          } else {
              break;
          }
      }

      // Push the weighted average to chartData
      if (totalWeight > 0) {
          chartData.unshift(Math.round(weightedSum / totalWeight));
      } else {
          chartData.unshift(0);
      }

      // Move to the previous time interval
      currentIntervalEnd = currentIntervalStart;
      currentIntervalStart -= interval;
  }

  return fillNullValues(chartData);
}

function fillNullValues(chartData) {
  // Iterate over the chartData array

  for (let i = 0; i < chartData.length; i++) {
      if (!chartData[i]) {
          log(chartData[i])
          // If the current value is null, find adjacent non-null values
          let leftIndex = i - 1;
          let rightIndex = i + 1;
          let leftValue = 0;
          let rightValue = 0;

          // Find the closest non-null value on the left side
          while (leftIndex >= 0) {
              if (chartData[leftIndex]) {
                  leftValue = chartData[leftIndex];
                  break;
              }
              leftIndex--;
          }

          // Find the closest non-null value on the right side
          while (rightIndex < chartData.length) {
              if (chartData[rightIndex]) {
                  rightValue = chartData[rightIndex];
                  break;
              }
              rightIndex++;
          }

          // If both left and right values are found, replace null with their average
          if (leftValue && rightValue) {
              chartData[i] = Math.round((leftValue + rightValue) / 2);
          } else if (leftValue) {
              // If only left value is found, replace null with it
              chartData[i] = leftValue;
          } else if (rightValue) {
              // If only right value is found, replace null with it
              chartData[i] = rightValue;
          }
      }
  }
  log(chartData)
  return chartData;
}


Script.complete();

