// lib/cron.ts
import fs from "fs"
import path from "path"
import cron from "node-cron"

const JOBS_FILE = path.resolve(process.cwd(), "./data/cron-jobs.json")

interface CronJobData {
  workflowId: string
  engine: string
  schedule: string
  inputPayload: any
}

const activeJobs: Record<string, cron.ScheduledTask> = {}

function loadJobsFromFile(): CronJobData[] {
  try {
    if (!fs.existsSync(JOBS_FILE)) return []
    const data = fs.readFileSync(JOBS_FILE, "utf-8")
    return JSON.parse(data) as CronJobData[]
  } catch (err) {
    console.error("Failed to load cron jobs:", err)
    return []
  }
}

function saveJobsToFile(jobs: CronJobData[]) {
  try {
    fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2), "utf-8")
  } catch (err) {
    console.error("Failed to save cron jobs:", err)
  }
}

function getJobKey(workflowId: string, engine: string) {
  return `${engine}:${workflowId}`
}

export function scheduleJob(job: CronJobData, triggerWorkflow: (job: CronJobData) => Promise<void>) {
  const key = getJobKey(job.workflowId, job.engine)
  if (activeJobs[key]) activeJobs[key].destroy()

  const task = cron.schedule(job.schedule, () => {
    console.log(`Running scheduled job for ${key}`)
    triggerWorkflow(job)
  })

  activeJobs[key] = task

  const existingJobs = loadJobsFromFile()
  const updatedJobs = existingJobs.filter(j => getJobKey(j.workflowId, j.engine) !== key)
  updatedJobs.push(job)
  saveJobsToFile(updatedJobs)
}

export function removeJob(workflowId: string, engine: string) {
  const key = getJobKey(workflowId, engine)
  if (activeJobs[key]) {
    activeJobs[key].destroy()
    delete activeJobs[key]
  }
  const existingJobs = loadJobsFromFile()
  const updatedJobs = existingJobs.filter(j => getJobKey(j.workflowId, j.engine) !== key)
  saveJobsToFile(updatedJobs)
}

export function initializeJobs(triggerWorkflow: (job: CronJobData) => Promise<void>) {
  const jobs = loadJobsFromFile()
  jobs.forEach(job => {
    try {
      scheduleJob(job, triggerWorkflow)
    } catch (err) {
      console.error("Failed to schedule job:", job, err)
    }
  })
}
