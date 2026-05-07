import { generateId } from '@/lib/generateId'
import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Plus,
  PencilSimple,
  Trash,
  MagnifyingGlass,
  Database as DatabaseIcon,
} from '@phosphor-icons/react'
import { toast } from 'sonner'

export type SimpleColumnType =
  | 'text'
  | 'number'
  | 'textarea'
  | 'select'
  | 'email'
  | 'password'

/** Select-mező egy opciója — string-shorthand vagy objektum külön label-lel. */
export type SimpleSelectOption = string | { value: string; label: string }

export interface SimpleColumnDef {
  key: string
  label: string
  type?: SimpleColumnType
  options?: SimpleSelectOption[]
  placeholder?: string
  required?: boolean
  /** Oszlop minimum szélessége táblázatban (px). */
  minWidth?: number
  /** Hosszú cellaszöveg vágása. */
  truncate?: boolean
  /** Ne jelenjen meg a táblázat oszlopaként (pl. PIN-mező). */
  hideInTable?: boolean
  /** Csak hozzáadáskor kötelező — szerkesztéskor üresen hagyható. */
  requiredOnCreateOnly?: boolean
  /** Súgószöveg a mező alatt a dialógusban. */
  helpText?: string
  /** Csak olvasható mező a dialógusban (megjelenik, de nem szerkeszthető). */
  readonly?: boolean
  /** Numerikus regex (csak digit karakterek). Pl. PIN-hez '\\d' / `[0-9]`. */
  digitOnly?: boolean
  /** Maximum karakterszám az inputon. */
  maxLength?: number
  /**
   * Cella-érték formatter a táblázathoz. Hasznos pl. select-mezőknél, ahol
   * a tárolt érték `'operator'`, de a táblázatban `'Operátor'`-t akarunk
   * mutatni. Ha undefined, a nyers érték jelenik meg.
   */
  formatCell?: (value: string) => string
  /**
   * Szerkesztéskor a tárolt érték → form-string konverzió. Pl. boolean
   * `active` mező: `"true"` → `"Igen"`. Ha undefined, az értéket
   * változatlanul (string-ként) töltjük a formba.
   */
  parseValue?: (raw: string) => string
  /** Új rekord létrehozásakor a form-mező alapértéke. */
  defaultValue?: string
}

function optionValue(o: SimpleSelectOption): string {
  return typeof o === 'string' ? o : o.value
}
function optionLabel(o: SimpleSelectOption): string {
  return typeof o === 'string' ? o : o.label
}

/**
 * Bármilyen rekord, amelynek van id/createdAt/updatedAt mezője.
 * A többi oszlopra dinamikusan, key alapján férünk hozzá.
 */
export interface SimpleRecord {
  id: string
  createdAt: string
  updatedAt: string
}

interface SimpleListViewProps<T extends SimpleRecord> {
  title: string
  description?: string
  emptyHint?: string
  /** Üres állapot ikon. */
  icon?: React.ReactNode
  items: T[]
  columns: SimpleColumnDef[]
  /**
   * Hozzáadás vagy szerkesztés mentésekor hívódik. Ha Promise-t ad vissza,
   * a dialógus csak sikeres resolve után záródik be (így backend-hibára a
   * felhasználó marad a dialógusban). Ha elutasít, a dialógus nyitva marad.
   */
  onSave: (record: T) => void | Promise<void>
  /**
   * Sor törlésekor hívódik. Ha Promise-t ad vissza, a megerősítő dialógus
   * csak sikeres resolve után záródik be.
   */
  onDelete: (id: string) => void | Promise<void>
  /** Új rekord button felirat. */
  addLabel?: string
  /** Dialog cím új rekord létrehozásakor. */
  addDialogTitle?: string
  /** Dialog cím szerkesztéskor. */
  editDialogTitle?: string
  /**
   * Sikertörlést követő toast szöveg. Default: "{title} módosítva" / "hozzáadva".
   * A backend-hibás esetet a komponens NEM tóst-olja (a hívó dolga).
   */
  successMessages?: { create?: string; update?: string; delete?: string }
  /**
   * Soronként extra akció gombok a Műveletek oszlopban (szerkesztés/törlés előtt).
   * Pl. részletek gomb megnyitásához.
   */
  extraActions?: (item: T) => React.ReactNode
  /**
   * Ha megadott és false-t ad vissza, a törlés gomb elrejtésre kerül az adott sornál.
   * Pl. operátor csak saját tételét törölheti.
   */
  canDelete?: (item: T) => boolean
}

/** Bármely oszlopértéket stringként olvassuk ki a sorból. */
function getCell(item: SimpleRecord, key: string): string {
  const v = (item as unknown as Record<string, unknown>)[key]
  if (v === undefined || v === null) return ''
  return String(v)
}

export function SimpleListView<T extends SimpleRecord>({
  title,
  description,
  emptyHint,
  icon,
  items,
  columns,
  onSave,
  onDelete,
  addLabel,
  addDialogTitle,
  editDialogTitle,
  successMessages,
  extraActions,
  canDelete,
}: SimpleListViewProps<T>) {
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    columns.forEach((c) => (init[c.key] = ''))
    return init
  })
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  /** A táblázatban megjelenítendő oszlopok (a hideInTable mezőket kihagyjuk). */
  const tableColumns = useMemo(
    () => columns.filter((c) => !c.hideInTable),
    [columns]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) =>
      tableColumns.some((c) => {
        const v = getCell(item, c.key)
        return v.toLowerCase().includes(q)
      })
    )
  }, [items, tableColumns, search])

  const openAdd = () => {
    const init: Record<string, string> = {}
    columns.forEach((c) => {
      init[c.key] = c.defaultValue ?? ''
    })
    setForm(init)
    setEditingId(null)
    setDialogOpen(true)
  }

  const openEdit = (item: T) => {
    const init: Record<string, string> = {}
    columns.forEach((c) => {
      // Password-mezőt szerkesztéskor üresen indítjuk: ha a felhasználó
      // nem ír bele, ne küldjük el a backendnek (azaz ne változtassa a PIN-t).
      if (c.type === 'password') {
        init[c.key] = ''
      } else {
        const raw = getCell(item, c.key)
        init[c.key] = c.parseValue ? c.parseValue(raw) : raw
      }
    })
    setForm(init)
    setEditingId(item.id)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (saving) return
    const isEdit = !!editingId
    // kötelező mezők ellenőrzése
    for (const c of columns) {
      const isRequired =
        c.required || (c.requiredOnCreateOnly && !isEdit)
      if (isRequired && !form[c.key]?.trim()) {
        toast.error(`A "${c.label}" kitöltése kötelező`)
        return
      }
    }
    const now = new Date().toISOString()
    const baseExisting = isEdit ? items.find((i) => i.id === editingId) : undefined

    const out: Record<string, string> = {
      id: editingId ?? generateId(),
      createdAt: baseExisting?.createdAt ?? now,
      updatedAt: now,
    }
    columns.forEach((c) => {
      const raw = form[c.key] ?? ''
      // Üres password-mezőt sose küldünk tovább szerkesztéskor — a
      // hívó (handleSaveUser) így tudja: ne változtass PIN-t.
      if (c.type === 'password' && isEdit && raw.trim() === '') {
        return
      }
      out[c.key] = raw
    })

    setSaving(true)
    try {
      await Promise.resolve(onSave(out as unknown as T))
      toast.success(
        isEdit
          ? successMessages?.update ?? `${title} módosítva`
          : successMessages?.create ?? `${title} hozzáadva`
      )
      setDialogOpen(false)
      setEditingId(null)
    } catch {
      // a hívó toast-olja a részletes hibát; a dialógust nyitva tartjuk
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId || deleting) return
    setDeleting(true)
    try {
      await Promise.resolve(onDelete(deleteId))
      toast.success(successMessages?.delete ?? 'Sor törölve')
      setDeleteId(null)
    } catch {
      // hívó toast-ol; a megerősítőt zárjuk, hogy a felhasználó újra próbálhassa
      setDeleteId(null)
    } finally {
      setDeleting(false)
    }
  }

  const renderField = (col: SimpleColumnDef) => {
    const id = `simple-field-${col.key}`
    const value = form[col.key] ?? ''
    const onChange = (v: string) => {
      // digitOnly: csak számjegyek; password mezőnél maxLength is alkalmazva
      let next = v
      if (col.digitOnly) next = next.replace(/\D/g, '')
      if (col.maxLength && next.length > col.maxLength) {
        next = next.slice(0, col.maxLength)
      }
      setForm((f) => ({ ...f, [col.key]: next }))
    }

    if (col.type === 'textarea') {
      return (
        <Textarea
          id={id}
          value={value}
          placeholder={col.placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          disabled={col.readonly}
        />
      )
    }
    if (col.type === 'select' && col.options?.length) {
      return (
        <Select value={value} onValueChange={onChange} disabled={col.readonly}>
          <SelectTrigger id={id}>
            <SelectValue placeholder={col.placeholder ?? 'Válasszon...'} />
          </SelectTrigger>
          <SelectContent>
            {col.options.map((opt) => {
              const v = optionValue(opt)
              return (
                <SelectItem key={v} value={v}>
                  {optionLabel(opt)}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      )
    }
    if (col.type === 'password') {
      return (
        <Input
          id={id}
          type="password"
          inputMode={col.digitOnly ? 'numeric' : 'text'}
          autoComplete="new-password"
          pattern={col.digitOnly ? '[0-9]*' : undefined}
          value={value}
          placeholder={col.placeholder}
          onChange={(e) => onChange(e.target.value)}
          disabled={col.readonly}
          maxLength={col.maxLength}
        />
      )
    }
    return (
      <Input
        id={id}
        type={col.type === 'number' ? 'number' : col.type === 'email' ? 'email' : 'text'}
        value={value}
        placeholder={col.placeholder}
        onChange={(e) => onChange(e.target.value)}
        disabled={col.readonly}
        maxLength={col.maxLength}
      />
    )
  }

  const isEmpty = items.length === 0
  const displayedEmpty = !isEmpty && filtered.length === 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <MagnifyingGlass
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
              weight="bold"
            />
            <Input
              placeholder="Keresés..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-full md:w-64"
            />
          </div>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="w-4 h-4" weight="bold" />
            {addLabel ?? 'Új hozzáadása'}
          </Button>
        </div>
      </div>

      {isEmpty ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center border-dashed">
          {icon ?? (
            <DatabaseIcon
              className="w-16 h-16 text-muted-foreground mb-4"
              weight="duotone"
            />
          )}
          <h3 className="text-xl font-semibold mb-2">Még nincs adat</h3>
          <p className="text-muted-foreground max-w-md mb-4">
            {emptyHint ?? 'Kezdje el az "Új hozzáadása" gombbal.'}
          </p>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="w-4 h-4" weight="bold" />
            {addLabel ?? 'Új hozzáadása'}
          </Button>
        </Card>
      ) : (
        <Card className="w-full">
          <ScrollArea className="w-full">
            <div className="min-w-max">
              <Table>
                <TableHeader>
                  <TableRow>
                    {tableColumns.map((c) => (
                      <TableHead
                        key={c.key}
                        style={c.minWidth ? { minWidth: c.minWidth } : undefined}
                      >
                        {c.label}
                      </TableHead>
                    ))}
                    <TableHead className="text-right min-w-[120px] sticky right-0 bg-card">
                      Műveletek
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedEmpty ? (
                    <TableRow>
                      <TableCell
                        colSpan={tableColumns.length + 1}
                        className="text-center text-muted-foreground py-10"
                      >
                        Nincs találat a keresésre.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((item) => (
                      <TableRow key={item.id}>
                        {tableColumns.map((c) => {
                          const raw = getCell(item, c.key)
                          const display = c.formatCell ? c.formatCell(raw) : raw
                          return (
                            <TableCell
                              key={c.key}
                              className={c.truncate ? 'max-w-[280px] truncate' : undefined}
                              title={c.truncate ? display : undefined}
                            >
                              {display || (
                                <span className="text-muted-foreground/60">—</span>
                              )}
                            </TableCell>
                          )
                        })}
                        <TableCell className="text-right sticky right-0 bg-card">
                          <div className="flex items-center justify-end gap-1">
                            {extraActions && extraActions(item)}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(item)}
                              aria-label="Szerkesztés"
                            >
                              <PencilSimple className="w-4 h-4" />
                            </Button>
                            {(canDelete === undefined || canDelete(item)) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteId(item.id)}
                                aria-label="Törlés"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? editDialogTitle ?? 'Szerkesztés'
                : addDialogTitle ?? 'Új hozzáadása'}
            </DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            {columns.map((col) => {
              const isCreate = !editingId
              const showRequiredMark =
                col.required || (col.requiredOnCreateOnly && isCreate)
              return (
                <div
                  key={col.key}
                  className={col.type === 'textarea' ? 'md:col-span-2' : ''}
                >
                  <Label htmlFor={`simple-field-${col.key}`} className="mb-1.5 block">
                    {col.label}
                    {showRequiredMark && (
                      <span className="text-destructive ml-0.5">*</span>
                    )}
                  </Label>
                  {renderField(col)}
                  {col.helpText && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {col.helpText}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Mégse
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving
                ? 'Mentés…'
                : editingId
                  ? 'Mentés'
                  : 'Hozzáadás'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Biztosan törli?</AlertDialogTitle>
            <AlertDialogDescription>
              Ez a művelet véglegesen eltávolítja a kiválasztott sort. A művelet nem
              vonható vissza.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Mégse</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Törlés…' : 'Törlés'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
