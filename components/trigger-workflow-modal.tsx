import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "./ui/textarea"
// import { ScrollArea } from "@/components/ui/scroll-area"
import { useEffect, useState } from "react"
import { Copy } from "lucide-react"

const CRON_REGEX = /^([0-5]?\d|\*) ([01]?\d|2[0-3]|\*) ([1-9]|[12]\d|3[01]|\*) (1[0-2]|0?[1-9]|\*) ([0-6]|\*)$/

function CronInputField({ onChange }: { onChange: (value: string, isValid: boolean) => void }) {
  const [cronValue, setCronValue] = useState("")
  const [isValid, setIsValid] = useState(true)

  useEffect(() => {
    const valid = CRON_REGEX.test(cronValue.trim())
    setIsValid(valid)
    onChange(cronValue.trim(), valid)
  }, [cronValue])

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700">Cron Expression</label>
      <input
        type="text"
        className={`w-full border p-2 rounded-md text-sm ${isValid ? "border-gray-300" : "border-red-500"}`}
        placeholder="e.g. 0 9 * * *"
        value={cronValue}
        onChange={(e) => setCronValue(e.target.value)}
      />
      {!isValid && (
        <p className="text-sm text-red-500">
          Invalid cron expression. Format: <code>min hour day month weekday</code>
        </p>
      )}
    </div>
  )
}

export default function TriggerWorkflowModal({
  isOpen,
  onOpenChange,
  triggerContext,
  closeTriggerModal,
  handleTriggerWorkflow,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  triggerContext: { workflowId: string; engine: string } | null
  closeTriggerModal: () => void
  handleTriggerWorkflow: (workflowId: string, engine: string, payload?: any) => Promise<void>
}) {
  const [activeTab, setActiveTab] = useState("manual")
  const [inputPayload, setInputPayload] = useState(`{
  "chat_input": {
    "input_text": "hello world!"
  }
}`)
  const [scheduleCron, setScheduleCron] = useState("")
  const [scheduleValid, setScheduleValid] = useState(false)
  
  const [log, setLog] = useState("") //handle real time logging

  const webhookURL = triggerContext
    ? `${window.location.origin}/api/hooks/${triggerContext.workflowId}`
    : ""

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Trigger Workflow</DialogTitle>
          <DialogDescription>Choose how to trigger this workflow</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(val) => {setActiveTab(val); setLog("")}} className="mt-4">
          <TabsList className="grid w-full grid-cols-3 mb-2">
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger value="webhook">Webhook</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4">
            <label className="text-sm font-medium text-gray-700">Input Payload (JSON)</label>

            <Textarea
                value={inputPayload}
                onChange={(e) => setInputPayload(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Tab") {
                    e.preventDefault()
                    const textarea = e.currentTarget
                    const start = textarea.selectionStart
                    const end = textarea.selectionEnd
                    const newValue =
                      inputPayload.substring(0, start) + "\t" + inputPayload.substring(end)

                    setInputPayload(newValue)

                    // Move cursor after the tab
                    requestAnimationFrame(() => {
                      textarea.selectionStart = textarea.selectionEnd = start + 1
                    })
                  }
                }}
                rows={10}
                className="font-mono text-xs"
              />
          </TabsContent>

          <TabsContent value="webhook" className="space-y-4 text-sm text-gray-600">
            <p>Send a POST request to this URL:</p>
              <div className="flex items-center gap-2">
                <pre className="bg-muted p-2 rounded text-xs font-mono break-words">
                    {webhookURL}
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      `https://your-domain.com/api/hooks/${triggerContext?.workflowId}`
                    )
                  }
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <p>You can test with curl or Postman by passing your input payload.</p>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4 text-sm text-gray-600">
                <CronInputField
                  onChange={(cron, valid) => {
                    setScheduleCron(cron)
                    setScheduleValid(valid)
                  }}
                />
          </TabsContent>
        </Tabs>

        <div className="flex flex-col items-end gap-2 pt-4">
          <div className="flex gap-2">
            <Button variant="ghost" onClick={closeTriggerModal}>
              Cancel
            </Button>
            <Button
              disabled={activeTab === "schedule" && !scheduleValid}
              onClick={async () => {
                if (triggerContext) {
                  try {
                    const payload =
                      activeTab === "manual"
                        ? JSON.parse(inputPayload || "{}")
                        : activeTab === "schedule"
                        ? { cron: scheduleCron }
                        : {}

                    setLog("⏳ Triggering workflow...")
                    await handleTriggerWorkflow(triggerContext.workflowId, triggerContext.engine, payload)
                    setLog("✅ Workflow triggered successfully.")
                    // closeTriggerModal()
                  } catch (err: any) {
                    setLog(`❌ Error: ${err.message}`)
                  }
                }
              }}
            >
              Trigger Now
            </Button>
          </div>

          {/* Logs Display */}
          {log && (
            <div className="w-full mt-4">
              <div className="bg-muted p-3 rounded-xl text-sm font-mono text-gray-800 max-h-48 overflow-y-auto border">
                <pre className="whitespace-pre-wrap">{log}</pre>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
