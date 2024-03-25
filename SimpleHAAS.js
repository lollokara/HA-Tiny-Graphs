// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: magic;
// Confguration
// EDIT HERE

const hassUrl = "http://idontknow:8123" //External URL
const hassUrl2 = "http://youshouldknow:8123" //Internal URL

const hassToken = "your dirty secrets"

const widgetTitlesAndSensors = [
  "Potenza e Tensione",
  "sensor.potenza",
  "sensor.voltaggio",
  "Autonomia BMW",
  "sensor.420d_xdrive_totale_autonomia_residua",
  "Luci Accese",
  "sensor.totale_luci" 
  ]


const titleText = "Home Assistant"

const backgroundColorStart = '#141414'
const backgroundColorEnd = '#010101'
const textColor = '#ffffff'
const sensorFontAndImageSize = 16
const titleFontAndImageSize = 12
const padding = 12
const maxNoOfSensors = 4

const states = await fetchAllStates()
const widget = new ListWidget()

const iconSymbolMap = {
  "mdi:calendar": "calendar"
}

const deviceClassSymbolMap = {
  "default": "house.fill",
  "voltage": "minus.plus.and.fluid.batteryblock",
  "energy": "bolt.fill",
  "humidity": "humidity.fill",
  "moisture": "drop.triangle.fill",
  "power": "bolt.fill",
  "volume": "lightbulb.fill",
  "temperature": "thermometer.medium",
  "distance": "bolt.car",
  "wind_speed": "wind"
}

setupBackground(widget)
const mainLayout = widget.addStack()
mainLayout.layoutVertically()
const titleStack = mainLayout.addStack()
titleStack.topAlignContent()
setupTitle(titleStack, titleText, deviceClassSymbolMap.default)
mainLayout.addSpacer()
const sensorStack = mainLayout.addStack()
sensorStack.layoutVertically()
sensorStack.bottomAlignContent()
widgetTitlesAndSensors.forEach(entry => {
  if (getState(states, entry)) {
    addSensor(sensorStack, entry)
  } else {
    setupTitle(sensorStack, entry)
  }
})

Script.setWidget(widget)
Script.complete()
widget.presentSmall()


function setupBackground() {
  const bGradient = new LinearGradient()
  bGradient.colors = [new Color(backgroundColorStart), new Color(backgroundColorEnd)]
  bGradient.locations = [0,1]
  widget.backgroundGradient = bGradient
  widget.setPadding(padding, padding, padding, padding)
  widget.spacing = 4
}

function setupTitle(widget, titleText, icon) {
  let titleStack = widget.addStack()
  titleStack.cornerRadius = 4
  titleStack.setPadding(2, 0, 0, 25)
  if (icon) {
   let wImage = titleStack.addImage(SFSymbol.named(icon).image)
    wImage.imageSize = new Size(titleFontAndImageSize, titleFontAndImageSize)  
    titleStack.addSpacer(5)
  }
  let wTitle = titleStack.addText(titleText)
  wTitle.font = Font.semiboldRoundedSystemFont(titleFontAndImageSize)
  wTitle.textColor = Color.white()
}

function addSensorValues(sensorStack, hassSensors) {
  hassSensors.forEach(sensor => {
    addSensor(sensorStack, sensor)
  })
}

function getSymbolForSensor(sensor) {
  if (iconSymbolMap[sensor.attributes.icon]) {
    return iconSymbolMap[sensor.attributes.icon]
  } else if (deviceClassSymbolMap[sensor.attributes.device_class]) {
    return deviceClassSymbolMap[sensor.attributes.device_class]
  } else {
    return deviceClassSymbolMap.default
  }
}

function addSensor(sensorStack, entityId) {
  const sensor = getState(states, entityId)
  
  const row = sensorStack.addStack()
  row.setPadding(0, 0, 0, 0)
  row.layoutHorizontally()
  
  const icon = row.addStack()
  icon.setPadding(1, 0, 0, 2)
  const sfSymbol = getSymbolForSensor(sensor)
  const sf = SFSymbol.named(sfSymbol)
  const imageNode = icon.addImage(sf.image)
  imageNode.imageSize = new Size(sensorFontAndImageSize, sensorFontAndImageSize)
  
  const value = row.addStack()
  value.setPadding(0, 0, 0, 4)
  const valueText = setSensorText(value, sensor)
  valueText.font = Font.mediumRoundedSystemFont(sensorFontAndImageSize)
  valueText.textColor = new Color(textColor)
  
  if (sensor.attributes.unit_of_measurement) {
    const unit = row.addStack()
    const unitText = unit.addText(sensor.attributes.unit_of_measurement)
    unitText.font = Font.mediumSystemFont(sensorFontAndImageSize)  
    unitText.textColor = new Color(textColor)
  }

}

function setSensorText(value, sensor) {
  if (sensor.attributes.device_class === "moisture") {
    return sensor.state === "on" ? value.addText("Wet") : value.addText("Dry") 
  } else {
    return value.addText(sensor.state)
  }
}

function addEmptyRow() {
  const row = widget.addStack()
  row.layoutHorizontally()
  const t = row.addText(' ')
   t.font = Font.mediumSystemFont(sensorFontAndImageSize)
}

async function fetchAllStates() {
  try {
    let req = new Request(`${hassUrl}/api/states`)
    req.timeoutInterval = 3
    req.headers = { 
      "Authorization": `Bearer ${hassToken}`, 
      "content-type": "application/json" 
    }
    return await req.loadJSON();
} catch (e) {
  let req = new Request(`${hassUrl2}/api/states`)
  req.headers = { 
    "Authorization": `Bearer ${hassToken}`, 
    "content-type": "application/json" 
  }
  return await req.loadJSON();
}
}

function getState(states, entityId) {
  return states.filter(state => state.entity_id === entityId)[0]
}
