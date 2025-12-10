import { useState } from 'react'
import { Sparkles, Copy, Save, RefreshCw, Loader2 } from 'lucide-react'
import { useGenerateOutreach, useSaveOutreachDraft } from '../../hooks/useOutreach'
import type { OutreachFormat, OutreachTone } from '../../services/outreach-generation'
import toast from 'react-hot-toast'

interface OutreachGeneratorProps {
  practiceId: string
  companyNumber: string
  companyName: string
  triggerEvent?: any
  networkConnection?: any
  onDraftGenerated?: (draft: any) => void
}

export function OutreachGenerator({
  practiceId,
  companyNumber,
  companyName,
  triggerEvent,
  networkConnection,
  onDraftGenerated,
}: OutreachGeneratorProps) {
  const [format, setFormat] = useState<OutreachFormat>('email_intro')
  const [tone, setTone] = useState<OutreachTone>('professional')
  const [draft, setDraft] = useState<any>(null)
  const generateOutreach = useGenerateOutreach()
  const saveDraft = useSaveOutreachDraft()

  const handleGenerate = async () => {
    try {
      const result = await generateOutreach.mutateAsync({
        practiceId,
        companyNumber,
        format,
        tone,
        triggerEvent,
        networkConnection,
      })
      setDraft(result)
      onDraftGenerated?.(result)
      toast.success('Outreach draft generated!')
    } catch (error: any) {
      toast.error('Error generating draft: ' + error.message)
    }
  }

  const handleCopy = () => {
    if (draft) {
      const text = draft.subject ? `${draft.subject}\n\n${draft.body}` : draft.body
      navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard!')
    }
  }

  const handleSave = async () => {
    if (!draft) return
    try {
      await saveDraft.mutateAsync({
        practiceId,
        companyNumber,
        format: draft.format,
        tone,
        subject: draft.subject,
        body: draft.body,
        personalizationPoints: draft.personalizationPoints,
      })
      toast.success('Draft saved!')
    } catch (error: any) {
      toast.error('Error saving draft: ' + error.message)
    }
  }

  return (
    <div className="space-y-6">
      {/* Format and Tone Selection */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as OutreachFormat)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="email_intro">Email Introduction</option>
            <option value="formal_letter">Formal Letter</option>
            <option value="linkedin_connect">LinkedIn Connect</option>
            <option value="linkedin_message">LinkedIn Message</option>
            <option value="warm_intro">Warm Introduction</option>
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as OutreachTone)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="formal">Formal</option>
            <option value="professional">Professional</option>
            <option value="friendly">Friendly</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={handleGenerate}
            disabled={generateOutreach.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {generateOutreach.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Draft
              </>
            )}
          </button>
        </div>
      </div>

      {/* Personalization Points */}
      {draft && draft.personalizationPoints && draft.personalizationPoints.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-gray-500">Personalised using:</span>
          {draft.personalizationPoints.map((point: string, idx: number) => (
            <span
              key={idx}
              className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
            >
              {point}
            </span>
          ))}
        </div>
      )}

      {/* Generated Draft */}
      {draft && (
        <div className="bg-white border rounded-lg p-6 space-y-4">
          {draft.subject && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
              <input
                type="text"
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              rows={12}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
            />
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <Copy className="h-4 w-4" />
              Copy
            </button>
            <button
              onClick={handleSave}
              disabled={saveDraft.isPending}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Save Draft
            </button>
            <button
              onClick={handleGenerate}
              disabled={generateOutreach.isPending}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

