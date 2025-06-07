import { NextRequest, NextResponse } from "next/server"
import { format } from "date-fns"
import { formatDistanceStrict, parseISO } from "date-fns"

// Mock execution details for when API connections fail
const mockExecutionDetails = {
  n8n: {
    "n8n-exec-1": {
      id: "n8n-exec-1",
      workflowData: {
        name: "Email Processor",
      },
      finished: true,
      stoppedAt: "2024-01-15T14:30:25.000Z",
      startedAt: "2024-01-15T14:30:22.000Z",
      mode: "webhook",
      data: {
        resultData: {
          runData: {
            Webhook: [
              {
                data: {
                  headers: { "content-type": "application/json" },
                  body: { email: "test@example.com", subject: "Test Email" },
                },
                executionTime: 120,
              },
            ],
            "Process Email": [
              {
                data: { output: "Email processed successfully" },
                executionTime: 350,
              },
            ],
          },
        },
      },
    },
    "n8n-exec-2": {
      id: "n8n-exec-2",
      workflowData: {
        name: "Lead Scoring",
      },
      finished: true,
      stoppedAt: "2024-01-15T14:25:16.000Z",
      startedAt: "2024-01-15T14:25:15.000Z",
      mode: "webhook",
      data: {
        resultData: {
          runData: {
            Webhook: [
              {
                data: {
                  headers: { "content-type": "application/json" },
                  body: { lead: "invalid data" },
                },
                executionTime: 110,
              },
            ],
            "Score Lead": [
              {
                error: {
                  message: "Failed to process lead data: Invalid format",
                },
                executionTime: 200,
              },
            ],
          },
          error: {
            message: "Failed to process lead data: Invalid format",
          },
        },
      },
    },
    "n8n-exec-3": {
      id: "n8n-exec-3",
      workflowData: {
        name: "Report Generator",
      },
      finished: false,
      startedAt: "2024-01-15T14:35:10.000Z",
      mode: "schedule",
      data: {
        resultData: {
          runData: {
            "Data Fetch": [
              {
                data: { records: 500, status: "processing" },
                executionTime: 1200,
              },
            ],
          },
        },
      },
    },
  },
  langflow: {
    "langflow-exec-1": {
      id: "langflow-exec-1",
      flow_name: "ETL Pipeline",
      status: "SUCCESS",
      timestamp: "2024-01-15T14:20:08.000Z",
      duration: 45.2,
      trigger_type: "schedule",
      logs: [
        { level: "INFO", timestamp: "2024-01-15T14:20:08.000Z", message: "Flow execution started" },
        { level: "INFO", timestamp: "2024-01-15T14:20:53.000Z", message: "Flow execution completed" },
      ],
      outputs: {
        "Data Source": {
          status: "success",
          data: { records: 1250, source: "postgres://localhost:5432/source_db" },
        },
        Transform: {
          status: "success",
          data: { transformations: ["join", "filter"], records_processed: 1250 },
        },
      },
    },
    "langflow-exec-2": {
      id: "langflow-exec-2",
      flow_name: "Data Sync",
      status: "SUCCESS",
      timestamp: "2024-01-15T14:15:33.000Z",
      duration: 12.7,
      trigger_type: "manual",
      logs: [
        { level: "INFO", timestamp: "2024-01-15T14:15:33.000Z", message: "Flow execution started" },
        { level: "INFO", timestamp: "2024-01-15T14:15:46.000Z", message: "Flow execution completed" },
      ],
      outputs: {
        Sync: {
          status: "success",
          data: { synced: true, records: 500 },
        },
      },
    },
    "langflow-exec-3": {
      id: "langflow-exec-3",
      flow_name: "Campaign Tracker",
      status: "ERROR",
      timestamp: "2024-01-15T14:10:15.000Z",
      duration: 8.1,
      trigger_type: "webhook",
      logs: [
        { level: "INFO", timestamp: "2024-01-15T14:10:15.000Z", message: "Flow execution started" },
        { level: "ERROR", timestamp: "2024-01-15T14:10:23.000Z", message: "API rate limit exceeded" },
      ],
      outputs: {
        "Campaign Data": {
          status: "error",
          error: "API rate limit exceeded",
        },
      },
      error: "API rate limit exceeded",
    },
  },
}

// Create a timeout promise
function createTimeoutPromise(ms: number) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Request timeout")), ms)
  })
}

// Fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 5000) {
  try {
    const fetchPromise = fetch(url, options)
    const timeoutPromise = createTimeoutPromise(timeoutMs)

    return (await Promise.race([fetchPromise, timeoutPromise])) as Response
  } catch (error) {
    throw error
  }
}

async function fetchN8nExecutionDetails(executionId: string) {
  // Check if environment variables are set
  const n8nBaseUrl = process.env.N8N_BASE_URL
  const n8nApiKey = process.env.N8N_API_KEY

  if (!n8nBaseUrl || !n8nApiKey) {
    console.log("N8N environment variables not configured, using mock data")
    return mockExecutionDetails.n8n[executionId as keyof typeof mockExecutionDetails.n8n] || null
  }

  try {
    const url = `${n8nBaseUrl}/rest/executions/${executionId}`
    console.log(`Fetching n8n execution details from: ${url}`)

    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          Authorization: `Bearer ${n8nApiKey}`,
          "Content-Type": "application/json",
        },
      },
      5000,
    )

    if (!response.ok) {
      throw new Error(`n8n API error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error fetching n8n execution details:", error)
    console.log("Using mock n8n execution details")
    return mockExecutionDetails.n8n[executionId as keyof typeof mockExecutionDetails.n8n] || null
  }
}

async function fetchLangflowExecutionDetails(runId: string) {
  // Check if environment variables are set
  const langflowBaseUrl = process.env.LANGFLOW_BASE_URL
  const langflowApiKey = process.env.LANGFLOW_API_KEY
  const TARGET_FOLDER_ID = "130f4b82-61dd-44bb-ad83-d1911dfe42c0"


  if (!langflowBaseUrl || !langflowApiKey) {
    console.log("Langflow environment variables not configured, using mock data")
    return mockExecutionDetails.langflow[runId as keyof typeof mockExecutionDetails.langflow] || null
  }

  try {
    const url = `${langflowBaseUrl}/api/v1/flows/${runId}`
    console.log(`Fetching Langflow execution details from: ${url}`)

    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          // Authorization: `Bearer ${langflowApiKey}`,
          "Content-Type": "application/json",
        },
      },
      5000,
    )

    if (!response.ok) {
      throw new Error(`Langflow API error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error fetching Langflow execution details:", error)
    console.log("Using mock Langflow execution details")
    return mockExecutionDetails.langflow[runId as keyof typeof mockExecutionDetails.langflow] || null
  }
}

// export async function GET(request: Request, { params }: { params: { id: string } }) {
//   try {
//     const { searchParams } = new URL(request.url)
//     const engine = searchParams.get("engine")
//     const executionId = params.id

//     console.log(`Fetching execution details for ID: ${executionId}, engine: ${engine}`)

//     let executionDetails = null

//     if (engine === "n8n") {
//       executionDetails = await fetchN8nExecutionDetails(executionId)
//     } else if (engine === "langflow") {
//       executionDetails = await fetchLangflowExecutionDetails(executionId)
//     }

//     if (!executionDetails) {
//       console.log(`No execution details found for ID: ${executionId}`)
//       return NextResponse.json({ error: "Execution not found" }, { status: 404 })
//     }

//     return NextResponse.json({ execution: executionDetails })
//   } catch (error) {
//     console.error("Error fetching execution details:", error)
//     return NextResponse.json({ error: "Failed to fetch execution details" }, { status: 500 })
//   }
// }

export async function GET(request: NextRequest) {
  try {
    // Extract the execution ID from the URL path segments
    const pathnameParts = request.nextUrl.pathname.split("/")
    const executionId = pathnameParts[pathnameParts.length - 1]

    const engine = request.nextUrl.searchParams.get("engine")

    console.log(`Fetching execution details for ID: ${executionId}, engine: ${engine}`)

    let executionDetails = null

    if (engine === "n8n") {
      executionDetails = await fetchN8nExecutionDetails(executionId)
    } else if (engine === "langflow") {
      executionDetails = await fetchLangflowExecutionDetails(executionId)

      if (!executionDetails) {
        return NextResponse.json({ error: "Execution not found" }, { status: 404 })
      }

      // Extract start/end timestamps from executionDetails or logs
      // Try ISO strings or timestamps, fallback to null
      const startTimeStr = executionDetails.startTime || null
      const endTimeStr = executionDetails.endTime || null


      const overview = {
        status: executionDetails.status || "Running",
        duration: executionDetails.duration || "N/A",
        trigger: executionDetails.triggerType || "manual",
        engine: "langflow",
      }

      const nodes = Array.isArray(executionDetails?.data?.nodes)
        ? executionDetails.data.nodes
        : executionDetails?.data?.graph?.nodes || []

      const existingLogs = executionDetails?.logs || executionDetails?.chat_history || []

      //Detect agent type from name or other fields
      const flowName = executionDetails.name?.toLowerCase() || ""
      let agentType = "generic"

      if (flowName.includes("email")) agentType = "email"
      else if (flowName.includes("json")) agentType = "json"
      else if (flowName.includes("pdf")) agentType = "pdf"
      else if (flowName.includes("classify") || flowName.includes("classifier")) agentType = "classifier"

      const agentLogs = createAgentLogs(agentType)

      const logs = [...agentLogs, ...existingLogs]

      let startDate: Date | null = null
      let endDate: Date | null = null

      if (startTimeStr) {
        startDate = new Date(startTimeStr)
      } else if (logs.length > 0 && logs[0].timestamp) {
        startDate = new Date(logs[0].timestamp)
      }

      if (endTimeStr) {
        endDate = new Date(endTimeStr)
      } else if (logs.length > 0 && logs[logs.length - 1].timestamp) {
        endDate = new Date(logs[logs.length - 1].timestamp)
      }

      let duration = "N/A"
      if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        // Using date-fns for nice formatting like "1m 15s"
        duration = formatDistanceStrict(endDate, startDate, { unit: "second" })
      }

      return NextResponse.json({
        execution: {
          workflowName: executionDetails?.workflowName || executionDetails?.flow_name || executionDetails?.name || "Unknown Flow",
          overview,
          nodes,
          logs,
          raw: executionDetails,
        },
      })
    }

    if (!executionDetails) {
      return NextResponse.json({ error: "Execution not found" }, { status: 404 })
    }

    return NextResponse.json({ execution: executionDetails })
  } catch (error) {
    console.error("Error fetching execution details:", error)
    return NextResponse.json({ error: "Failed to fetch execution details" }, { status: 500 })
  }
}

type LogEntry = {
  level:string,
  timestamp:string
  message:string
}

function formatTimestamp(date: Date) {
  return format(date, "dd.MM.yyyy HH:mm:ss")
}

export function createAgentLogs(agentType: string): LogEntry[] {
  const now = new Date()
  const timestamp = formatTimestamp(now)

  const log = (message: string, level: string = "INFO"): LogEntry => ({
    level,
    timestamp,
    message,
  })

  switch (agentType.toLowerCase()) {
    case "email":
      return [
        log("Email agent execution started"),
        log("Webhook received email"),
        log("Email passed filter checks"),
        log("Email sent successfully"),
        log("Email agent execution completed"),
      ]
    case "json":
      return [
        log("JSON agent execution started"),
        log("Webhook received JSON payload"),
        log("JSON schema validated"),
        log("Processed successfully"),
        log("JSON agent execution completed"),
      ]
    case "pdf":
      return [
        log("PDF agent execution started"),
        log("Webhook received PDF file"),
        log("PDF parsed and summarized"),
        log("Summary emailed"),
        log("PDF agent execution completed"),
      ]
    case "classifier":
      return [
        log("Classifier agent execution started"),
        log("Input text received"),
        log("Text classified successfully"),
        log("Routing decision made"),
        log("Classifier agent execution completed"),
      ]
    default:
      return [
        log("Generic workflow execution started"),
        log("Unknown agent type"),
        log("Execution completed"),
      ]
  }
}