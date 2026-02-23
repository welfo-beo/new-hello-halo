import { useState, useEffect } from 'react'
import { Plus, Trash2, Upload } from 'lucide-react'
import { api } from '../../api'

interface SkillDef {
  name: string
  description?: string
  content: string
  source: 'global' | 'space'
  filePath: string
}

export function SkillsSection({ spaceDir }: { spaceDir?: string }) {
  const [skills, setSkills] = useState<SkillDef[]>([])
  const [selected, setSelected] = useState<SkillDef | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editName, setEditName] = useState('')
  const [creating, setCreating] = useState(false)

  const load = () => {
    api.skillsList(spaceDir).then(r => { if (r.success) setSkills(r.data as SkillDef[]) })
  }

  useEffect(() => { load() }, [spaceDir])

  const handleSelect = (skill: SkillDef) => {
    setSelected(skill)
    setEditContent(skill.content)
    setEditName(skill.name)
    setCreating(false)
  }

  const handleNew = () => {
    setSelected(null)
    setEditContent('---\ndescription: My skill\n---\n\nDescribe what this skill does.')
    setEditName('my-skill')
    setCreating(true)
  }

  const handleSave = async () => {
    await api.skillsSave(editName, editContent, 'global', spaceDir)
    load()
    setCreating(false)
  }

  const handleUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.md'
    input.multiple = true
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files
      if (!files) return
      for (const file of Array.from(files)) {
        const content = await file.text()
        const name = file.name.replace(/\.md$/, '')
        await api.skillsSave(name, content, 'global', spaceDir)
      }
      load()
    }
    input.click()
  }

  const handleDelete = async (skill: SkillDef) => {
    await api.skillsDelete(skill.filePath)
    load()
    if (selected?.filePath === skill.filePath) { setSelected(null); setCreating(false) }
  }

  return (
    <section id="skills" className="bg-card rounded-xl border border-border p-6">
      <h2 className="text-lg font-medium mb-4">Skills</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Custom slash commands. Type <code className="bg-secondary px-1 rounded">/</code> in the chat input to use them.
      </p>
      <div className="flex gap-4">
        <div className="w-40 shrink-0">
          <div className="flex gap-1 mb-2">
            <button onClick={handleNew} className="flex-1 flex items-center gap-1 px-2 py-1.5 text-xs bg-secondary rounded hover:bg-secondary/80">
              <Plus className="w-3 h-3" /> New
            </button>
            <button onClick={handleUpload} className="flex items-center gap-1 px-2 py-1.5 text-xs bg-secondary rounded hover:bg-secondary/80" title="Upload .md files">
              <Upload className="w-3 h-3" />
            </button>
          </div>
          {skills.map(s => (
            <div key={s.filePath} className={`flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer mb-1 ${selected?.filePath === s.filePath ? 'bg-primary/20' : 'hover:bg-secondary'}`}>
              <span onClick={() => handleSelect(s)} className="flex-1 truncate">/{s.name}</span>
              <button onClick={() => handleDelete(s)} className="text-destructive hover:opacity-80 ml-1">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        {(selected || creating) && (
          <div className="flex-1">
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="skill-name"
              className="w-full px-2 py-1 text-sm border border-border rounded bg-background mb-2"
            />
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="w-full h-48 p-2 text-xs font-mono border border-border rounded bg-background resize-y"
            />
            <button onClick={handleSave} className="mt-2 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm">
              Save
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
