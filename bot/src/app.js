require('dotenv').config()
const express = require('express')
const webhookRoute = require('./routes/webhook')
const healthRoute = require('./routes/health')
const { startJobs } = require('./jobs/dailySummary')
const { startReminderJob } = require('./jobs/sendReminders')
const { startWeeklySummaryJob } = require('./jobs/weeklySummary')

const app = express()

app.use('/webhook', webhookRoute)
app.use('/health', healthRoute)

startJobs()
startReminderJob()
startWeeklySummaryJob()

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Bot running on port ${PORT}`)
})
