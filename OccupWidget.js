// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: red; icon-glyph: magic;
"use strict";
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
const history = await fetchHistory()
let chartDT = [];
const sensorData = {};


async function processData() {
  // Ensure sensorData is populated before proceeding
  chartDT = generateChartData(history);
  return exec();
}

async function exec() {
  const widget = createWidget({
    chartData: chartDT,
    subtitle1: `UPDATED: ${dateFormatter.string(new Date())}`,
    value: `SALA`,
    headerSymbol: 'dot.radiowaves.left.and.right',
    header: '  RADAR STATUS:'
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

async function fetchHistory() {
  try {
    let req = new Request(`${hassUrl}/api/history/period?filter_entity_id=binary_sensor.radar_2_presence&minimal_response`)
    req.timeoutInterval = 6
    req.headers = { 
      "Authorization": `Bearer ${hassToken}`, 
      "content-type": "application/json"
    }
    return await req.loadJSON();
  } catch (e) {
    let req = new Request(`${hassUrl2}/api/history/period?filter_entity_id=binary_sensor.radar_2_presence&minimal_response`)
    req.timeoutInterval = 3
    req.headers = { 
      "Authorization": `Bearer ${hassToken}`, 
      "content-type": "application/json"
    }
    return await req.loadJSON();
  }
}

function generateChartData(inputData) {
  // Extract state and timestamp from input data
  const states = inputData[0].map(entry => ({
      state: entry.state,
      timestamp: new Date(entry.last_changed).getTime()
  }));

  // Determine time range (last 1 hour)
  const currentTime = new Date();
  const oneHourAgo = currentTime.getTime() - (60 * 60 * 1000);

  // Create an array of 200 elements representing 1 hour time slots
  const interval = (60 * 60 * 1000) / 200;
  const summaryArray = new Array(200).fill(null);

  // Iterate over the input data and update summaryArray
  states.forEach(({ state, timestamp }) => {
      if (timestamp >= oneHourAgo && timestamp <= currentTime.getTime()) {
          const index = Math.floor((timestamp - oneHourAgo) / interval);
          if (summaryArray[index] === null || timestamp > summaryArray[index].timestamp) {
              summaryArray[index] = { state: state === 'on' ? 1 : 0, timestamp };
          }
      }
  });

  // Fill null values with the previous state
  for (let i = 0; i < summaryArray.length; i++) {
      if (summaryArray[i] === null && i > 0) {
          summaryArray[i] = summaryArray[i - 1];
      }
  }

  // Extract state values from summaryArray, handling null values
  return summaryArray.map(entry => entry ? entry.state : 0);
}

Script.complete();