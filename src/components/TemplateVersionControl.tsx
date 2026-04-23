import { useState, useMemo, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  GitBranch, GitCommit, GitMerge, GitPullRequest, Clock, Upload, Download, 
  Eye, Code, Play, ArrowsClockwise, Copy, Check, Plus, Trash, FolderOpen
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface TemplateVersion {
  id: string
  commitHash: string
  branch: string
  commitMessage: string
  author: string
  timestamp: string
  parentCommitHash?: string
  htmlContent: string
  styles: Record<string, any>
  metadata: {
    type: 'cmr' | 'delivery'
    version: string
  }
}

interface Branch {
  name: string
  headCommit: string
  createdAt: string
  description: string
}

const INITIAL_BRANCHES: Branch[] = [
  {
    name: 'main',
    headCommit: '',
    createdAt: new Date().toISOString(),
    description: 'Fő branch az éles sablonokhoz'
  }
]

export function TemplateVersionControl() {
  const [versions, setVersions] = useKV<TemplateVersion[]>('template-versions', [])
  const [branches, setBranches] = useKV<Branch[]>('template-branches', INITIAL_BRANCHES)
  const [currentBranch, setCurrentBranch] = useKV<string>('current-template-branch', 'main')
  
  const [selectedVersion, setSelectedVersion] = useState<TemplateVersion | null>(null)
  const [compareVersion, setCompareVersion] = useState<TemplateVersion | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [htmlContent, setHtmlContent] = useState('')
  const [stylesJson, setStylesJson] = useState('')
  
  const [commitDialogOpen, setCommitDialogOpen] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [branchDialogOpen, setBranchDialogOpen] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [newBranchDescription, setNewBranchDescription] = useState('')
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)
  const [mergeBranch, setMergeBranch] = useState('')
  
  const [filterType, setFilterType] = useState<'all' | 'cmr' | 'delivery'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedHash, setCopiedHash] = useState('')

  const filteredVersions = useMemo(() => {
    let filtered = (versions || []).filter(v => v.branch === currentBranch)
    
    if (filterType !== 'all') {
      filtered = filtered.filter(v => v.metadata.type === filterType)
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(v =>
        v.commitMessage.toLowerCase().includes(query) ||
        v.author.toLowerCase().includes(query) ||
        v.commitHash.toLowerCase().includes(query)
      )
    }
    
    return filtered.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  }, [versions, currentBranch, filterType, searchQuery])

  const currentBranchObj = useMemo(() => {
    return (branches || []).find(b => b.name === currentBranch)
  }, [branches, currentBranch])

  const latestCommit = useMemo(() => {
    return filteredVersions.length > 0 ? filteredVersions[0] : null
  }, [filteredVersions])

  useEffect(() => {
    if (latestCommit && currentBranchObj && currentBranchObj.headCommit !== latestCommit.commitHash) {
      setBranches((current) =>
        (current || []).map(b =>
          b.name === currentBranch
            ? { ...b, headCommit: latestCommit.commitHash }
            : b
        )
      )
    }
  }, [latestCommit, currentBranchObj, currentBranch, setBranches])

  const generateCommitHash = () => {
    return Math.random().toString(36).substring(2, 9)
  }

  const handleCommit = () => {
    if (!commitMessage.trim()) {
      toast.error('Commit üzenet kötelező')
      return
    }

    if (!htmlContent.trim()) {
      toast.error('HTML tartalom nem lehet üres')
      return
    }

    let parsedStyles: Record<string, any> = {}
    try {
      parsedStyles = JSON.parse(stylesJson || '{}')
    } catch (error) {
      toast.error('Érvénytelen JSON formátum a stílusokban')
      return
    }

    const newVersion: TemplateVersion = {
      id: Date.now().toString(),
      commitHash: generateCommitHash(),
      branch: currentBranch || 'main',
      commitMessage: commitMessage,
      author: 'Felhasználó',
      timestamp: new Date().toISOString(),
      parentCommitHash: latestCommit?.commitHash || undefined,
      htmlContent: htmlContent,
      styles: parsedStyles,
      metadata: {
        type: parsedStyles.type || 'delivery',
        version: '1.0'
      }
    }

    setVersions((current) => [newVersion, ...(current || [])])
    toast.success(`Commit létrehozva: ${newVersion.commitHash}`)
    
    setCommitMessage('')
    setCommitDialogOpen(false)
  }

  const handleCreateBranch = () => {
    if (!newBranchName.trim()) {
      toast.error('Branch név kötelező')
      return
    }

    const branchExists = (branches || []).some(b => b.name === newBranchName)
    if (branchExists) {
      toast.error('Ez a branch már létezik')
      return
    }

    const newBranch: Branch = {
      name: newBranchName,
      headCommit: latestCommit?.commitHash || '',
      createdAt: new Date().toISOString(),
      description: newBranchDescription
    }

    setBranches((current) => [...(current || []), newBranch])
    toast.success(`Branch létrehozva: ${newBranchName}`)
    
    setNewBranchName('')
    setNewBranchDescription('')
    setBranchDialogOpen(false)
  }

  const handleSwitchBranch = (branchName: string) => {
    setCurrentBranch(branchName)
    toast.success(`Váltás: ${branchName}`)
  }

  const handleMergeBranch = () => {
    if (!mergeBranch) {
      toast.error('Válasszon egy branch-et az összeolvasztáshoz')
      return
    }

    const targetVersions = (versions || []).filter(v => v.branch === mergeBranch)
    
    if (targetVersions.length === 0) {
      toast.error('Nincs commit a kiválasztott branch-en')
      return
    }

    const mergedVersions: TemplateVersion[] = targetVersions.map(v => ({
      ...v,
      id: Date.now().toString() + Math.random(),
      commitHash: generateCommitHash(),
      branch: currentBranch || 'main',
      parentCommitHash: latestCommit?.commitHash || undefined,
      commitMessage: `Merge from ${mergeBranch}: ${v.commitMessage}`
    }))

    setVersions((current) => [...mergedVersions, ...(current || [])])
    toast.success(`${mergedVersions.length} commit merge-elve ${mergeBranch} → ${currentBranch}`)
    
    setMergeBranch('')
    setMergeDialogOpen(false)
  }

  const handleDeleteBranch = (branchName: string) => {
    if (branchName === 'main') {
      toast.error('A main branch nem törölhető')
      return
    }

    if (branchName === currentBranch) {
      toast.error('Az aktív branch nem törölhető')
      return
    }

    setBranches((current) => (current || []).filter(b => b.name !== branchName))
    toast.success(`Branch törölve: ${branchName}`)
  }

  const handleLoadVersion = (version: TemplateVersion) => {
    setHtmlContent(version.htmlContent)
    setStylesJson(JSON.stringify(version.styles, null, 2))
    setSelectedVersion(version)
    setEditMode(true)
    toast.success(`Verzió betöltve: ${version.commitHash}`)
  }

  const handlePreview = (version: TemplateVersion) => {
    setPreviewHtml(version.htmlContent)
    setSelectedVersion(version)
  }

  const handleExportVersion = (version: TemplateVersion) => {
    const exportData = {
      version: '1.0',
      commitHash: version.commitHash,
      branch: version.branch,
      commitMessage: version.commitMessage,
      timestamp: version.timestamp,
      htmlContent: version.htmlContent,
      styles: version.styles,
      metadata: version.metadata
    }

    const dataStr = JSON.stringify(exportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `template-${version.commitHash}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Verzió exportálva')
  }

  const handleImportVersion = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          try {
            const importedData = JSON.parse(event.target?.result as string)
            
            if (!importedData.htmlContent || !importedData.commitMessage) {
              toast.error('Érvénytelen verzió formátum')
              return
            }

            const newVersion: TemplateVersion = {
              id: Date.now().toString(),
              commitHash: generateCommitHash(),
              branch: currentBranch || 'main',
              commitMessage: `Imported: ${importedData.commitMessage}`,
              author: 'Felhasználó',
              timestamp: new Date().toISOString(),
              parentCommitHash: latestCommit?.commitHash || undefined,
              htmlContent: importedData.htmlContent,
              styles: importedData.styles || {},
              metadata: importedData.metadata || { type: 'delivery', version: '1.0' }
            }

            setVersions((current) => [newVersion, ...(current || [])])
            toast.success('Verzió importálva')
          } catch (error) {
            toast.error('Importálás sikertelen')
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash)
    setCopiedHash(hash)
    setTimeout(() => setCopiedHash(''), 2000)
    toast.success('Hash másolva')
  }

  const generateDiff = (v1: TemplateVersion, v2: TemplateVersion) => {
    const lines1 = v1.htmlContent.split('\n')
    const lines2 = v2.htmlContent.split('\n')
    const maxLen = Math.max(lines1.length, lines2.length)
    
    const diff = []
    for (let i = 0; i < maxLen; i++) {
      const line1 = lines1[i] || ''
      const line2 = lines2[i] || ''
      
      if (line1 !== line2) {
        if (line1 && !line2) {
          diff.push({ type: 'removed', line: line1, lineNum: i + 1 })
        } else if (!line1 && line2) {
          diff.push({ type: 'added', line: line2, lineNum: i + 1 })
        } else {
          diff.push({ type: 'modified', line1, line2, lineNum: i + 1 })
        }
      }
    }
    
    return diff
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sablon Verziókezelés</h2>
          <p className="text-muted-foreground">GitHub-szerű verziókezelő rendszer sablonokhoz</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleImportVersion} className="gap-2">
            <Upload className="w-4 h-4" />
            Import
          </Button>
          <Button variant="outline" onClick={() => setBranchDialogOpen(true)} className="gap-2">
            <GitBranch className="w-4 h-4" />
            Új Branch
          </Button>
          <Button onClick={() => {
            setEditMode(true)
            setHtmlContent('')
            setStylesJson('{\n  "type": "delivery"\n}')
          }} className="gap-2">
            <Plus className="w-4 h-4" />
            Új Sablon
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-primary" weight="duotone" />
            <Select value={currentBranch} onValueChange={handleSwitchBranch}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(branches || []).map((branch) => (
                  <SelectItem key={branch.name} value={branch.name}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator orientation="vertical" className="h-8" />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setMergeDialogOpen(true)}
            className="gap-2"
          >
            <GitMerge className="w-4 h-4" />
            Merge
          </Button>

          <div className="flex-1" />

          <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Összes típus</SelectItem>
              <SelectItem value="cmr">CMR</SelectItem>
              <SelectItem value="delivery">Szállítólevél</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Keresés commit üzenet, szerző..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[300px]"
          />
        </div>
      </Card>

      <Tabs defaultValue="commits" className="space-y-6">
        <TabsList>
          <TabsTrigger value="commits" className="gap-2">
            <GitCommit className="w-4 h-4" />
            Commits
          </TabsTrigger>
          <TabsTrigger value="branches" className="gap-2">
            <GitBranch className="w-4 h-4" />
            Branches
          </TabsTrigger>
          <TabsTrigger value="editor" className="gap-2">
            <Code className="w-4 h-4" />
            Szerkesztő
          </TabsTrigger>
          {selectedVersion && compareVersion && (
            <TabsTrigger value="diff" className="gap-2">
              <GitPullRequest className="w-4 h-4" />
              Diff
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="commits" className="space-y-4">
          {filteredVersions.length === 0 ? (
            <Alert>
              <AlertDescription>
                Nincs commit ezen a branch-en. Hozzon létre egy új sablont a Szerkesztő fülön.
              </AlertDescription>
            </Alert>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {filteredVersions.map((version, index) => (
                  <Card key={version.id} className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <GitCommit className="w-5 h-5 text-primary" weight="duotone" />
                        </div>
                        {index < filteredVersions.length - 1 && (
                          <div className="absolute top-10 left-1/2 w-0.5 h-8 bg-border -translate-x-1/2" />
                        )}
                      </div>

                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{version.commitMessage}</h4>
                              <Badge variant="outline">
                                {version.metadata.type === 'cmr' ? 'CMR' : 'Szállítólevél'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <button
                                  onClick={() => handleCopyHash(version.commitHash)}
                                  className="flex items-center gap-1 hover:text-foreground transition-colors font-mono"
                                >
                                  {version.commitHash}
                                  {copiedHash === version.commitHash ? (
                                    <Check className="w-3 h-3" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </span>
                              <span>{version.author}</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(version.timestamp).toLocaleString('hu-HU')}
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePreview(version)}
                              className="gap-1"
                            >
                              <Eye className="w-4 h-4" />
                              Előnézet
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleLoadVersion(version)}
                              className="gap-1"
                            >
                              <FolderOpen className="w-4 h-4" />
                              Betöltés
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleExportVersion(version)}
                              className="gap-1"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant={compareVersion?.id === version.id ? 'default' : 'outline'}
                              onClick={() => setCompareVersion(version)}
                              className="gap-1"
                            >
                              <ArrowsClockwise className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {version.parentCommitHash && (
                          <div className="text-xs text-muted-foreground">
                            Parent: <span className="font-mono">{version.parentCommitHash}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="branches" className="space-y-4">
          <div className="grid gap-4">
            {(branches || []).map((branch) => {
              const branchVersions = (versions || []).filter(v => v.branch === branch.name)
              const lastCommit = branchVersions.length > 0 
                ? branchVersions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
                : null

              return (
                <Card key={branch.name} className={cn(
                  "p-4",
                  branch.name === currentBranch && "border-primary"
                )}>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-5 h-5 text-primary" weight="duotone" />
                        <h3 className="text-lg font-semibold">{branch.name}</h3>
                        {branch.name === currentBranch && (
                          <Badge>Aktív</Badge>
                        )}
                      </div>
                      
                      {branch.description && (
                        <p className="text-sm text-muted-foreground">{branch.description}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{branchVersions.length} commit</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(branch.createdAt).toLocaleDateString('hu-HU')}
                        </span>
                        {lastCommit && (
                          <span className="font-mono text-xs">
                            HEAD: {lastCommit.commitHash}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {branch.name !== currentBranch && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSwitchBranch(branch.name)}
                          >
                            Váltás
                          </Button>
                          {branch.name !== 'main' && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteBranch(branch.name)}
                            >
                              <Trash className="w-4 h-4" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="editor" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6 space-y-4">
              <div>
                <Label htmlFor="html-editor">HTML Sablon</Label>
                <Textarea
                  id="html-editor"
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  placeholder="Illessze be vagy írja be a HTML sablont..."
                  rows={20}
                  className="font-mono text-sm"
                />
              </div>

              <div>
                <Label htmlFor="styles-editor">Stílusok (JSON)</Label>
                <Textarea
                  id="styles-editor"
                  value={stylesJson}
                  onChange={(e) => setStylesJson(e.target.value)}
                  placeholder='{"type": "delivery", "primaryColor": "#2c5aa0"}'
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setPreviewHtml(htmlContent)
                    toast.success('Előnézet frissítve')
                  }}
                  className="gap-2"
                >
                  <Play className="w-4 h-4" />
                  Előnézet
                </Button>
                <Button
                  onClick={() => setCommitDialogOpen(true)}
                  variant="default"
                  className="gap-2"
                >
                  <GitCommit className="w-4 h-4" />
                  Commit
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Élő Előnézet</h3>
              {previewHtml ? (
                <div className="border rounded-lg overflow-auto" style={{ maxHeight: '700px' }}>
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full border-0"
                    style={{ minHeight: '600px', transform: 'scale(0.8)', transformOrigin: 'top left', width: '125%' }}
                    title="Template Preview"
                  />
                </div>
              ) : (
                <Alert>
                  <AlertDescription>
                    Nincs előnézet. Kattintson az "Előnézet" gombra a sablon megjelenítéséhez.
                  </AlertDescription>
                </Alert>
              )}
            </Card>
          </div>
        </TabsContent>

        {selectedVersion && compareVersion && (
          <TabsContent value="diff" className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Diff nézet</h3>
                  <p className="text-sm text-muted-foreground">
                    {compareVersion.commitHash} ← {selectedVersion.commitHash}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCompareVersion(null)
                    setSelectedVersion(null)
                  }}
                >
                  Bezár
                </Button>
              </div>

              <ScrollArea className="h-[600px]">
                <div className="font-mono text-sm space-y-1">
                  {generateDiff(compareVersion, selectedVersion).map((diff, index) => {
                    if (diff.type === 'removed') {
                      return (
                        <div key={index} className="bg-destructive/10 text-destructive px-3 py-1">
                          <span className="text-muted-foreground mr-2">{diff.lineNum}</span>
                          <span className="mr-2">-</span>
                          {diff.line}
                        </div>
                      )
                    } else if (diff.type === 'added') {
                      return (
                        <div key={index} className="bg-success/10 text-success px-3 py-1">
                          <span className="text-muted-foreground mr-2">{diff.lineNum}</span>
                          <span className="mr-2">+</span>
                          {diff.line}
                        </div>
                      )
                    } else if (diff.type === 'modified') {
                      return (
                        <div key={index}>
                          <div className="bg-destructive/10 text-destructive px-3 py-1">
                            <span className="text-muted-foreground mr-2">{diff.lineNum}</span>
                            <span className="mr-2">-</span>
                            {diff.line1}
                          </div>
                          <div className="bg-success/10 text-success px-3 py-1">
                            <span className="text-muted-foreground mr-2">{diff.lineNum}</span>
                            <span className="mr-2">+</span>
                            {diff.line2}
                          </div>
                        </div>
                      )
                    }
                    return null
                  })}
                </div>
              </ScrollArea>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={commitDialogOpen} onOpenChange={setCommitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Új Commit</DialogTitle>
            <DialogDescription>
              Commit-olja a változtatásokat a(z) <strong>{currentBranch}</strong> branch-re.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="commit-message">Commit üzenet</Label>
              <Textarea
                id="commit-message"
                placeholder="pl. Fejléc színének módosítása"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommitDialogOpen(false)}>
              Mégse
            </Button>
            <Button onClick={handleCommit} className="gap-2">
              <GitCommit className="w-4 h-4" />
              Commit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Új Branch létrehozása</DialogTitle>
            <DialogDescription>
              Hozzon létre egy új branch-et a(z) <strong>{currentBranch}</strong> branch-ről.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="branch-name">Branch neve</Label>
              <Input
                id="branch-name"
                placeholder="pl. feature/uj-dizajn"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="branch-description">Leírás (opcionális)</Label>
              <Textarea
                id="branch-description"
                placeholder="Rövid leírás a branch céljáról..."
                value={newBranchDescription}
                onChange={(e) => setNewBranchDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBranchDialogOpen(false)}>
              Mégse
            </Button>
            <Button onClick={handleCreateBranch} className="gap-2">
              <GitBranch className="w-4 h-4" />
              Létrehozás
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Branch Merge</DialogTitle>
            <DialogDescription>
              Válasszon egy branch-et, amit merge-elni szeretne a(z) <strong>{currentBranch}</strong> branch-be.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="merge-branch">Forrás Branch</Label>
              <Select value={mergeBranch} onValueChange={setMergeBranch}>
                <SelectTrigger id="merge-branch">
                  <SelectValue placeholder="Válasszon branch-et" />
                </SelectTrigger>
                <SelectContent>
                  {(branches || [])
                    .filter(b => b.name !== currentBranch)
                    .map((branch) => (
                      <SelectItem key={branch.name} value={branch.name}>
                        {branch.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)}>
              Mégse
            </Button>
            <Button onClick={handleMergeBranch} className="gap-2">
              <GitMerge className="w-4 h-4" />
              Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
