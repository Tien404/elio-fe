import type { AttemptView, QuizService } from './quiz-contracts'
type AnswerService = Pick<QuizService, 'attempt' | 'saveAnswer' | 'seal'>
interface QueueState {
  view: AttemptView
  expectedVersion: number
  local: Record<string, string>
  pending: number
  saving: Record<string, string>
  paused: boolean
  sealing: boolean
  error: Error | null
  reviewed: AttemptView | null
}
interface CachedChoices {
  expectedVersion: number
  local: Record<string, string>
}
export class AnswerQueue {
  private state: QueueState
  private tail: Promise<void> = Promise.resolve()
  private latestSave = new Map<number, symbol>()
  private listeners = new Set<() => void>()
  private storageKey: string
  private service: AnswerService
  constructor(service: AnswerService, initial: AttemptView, actorId: number) {
    this.service = service
    this.storageKey = `elio.quiz.choices.${actorId}.${initial.attempt.id}`
    let cached: CachedChoices | null
    try {
      cached = JSON.parse(sessionStorage.getItem(this.storageKey) ?? 'null') as CachedChoices | null
    } catch {
      cached = null
    }
    const local: Record<string, string> = {}
    if (cached?.local)
      for (const [id, key] of Object.entries(cached.local)) {
        const q = initial.attempt.questions.find((q) => String(q.id) === id)
        if (q && Object.hasOwn(q.options, key) && initial.attempt.answers[id] !== key)
          local[id] = key
      }
    const old = Object.keys(local).length
      ? (cached?.expectedVersion ?? initial.attempt.version)
      : initial.attempt.version
    this.state = {
      view: initial,
      expectedVersion: old,
      local,
      pending: 0,
      saving: {},
      paused: old !== initial.attempt.version,
      sealing: false,
      error:
        old !== initial.attempt.version
          ? new Error(
              'Saved attempt changed while this tab was away. Review saved answers before continuing.',
            )
          : null,
      reviewed: null,
    }
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  getSnapshot = () => this.state
  private update(values: Partial<QueueState>) {
    this.state = { ...this.state, ...values }
    try {
      sessionStorage.setItem(
        this.storageKey,
        JSON.stringify({ expectedVersion: this.state.expectedVersion, local: this.state.local }),
      )
    } catch {
      /* The durable service remains authoritative if tab storage is unavailable. */
    }
    for (const listener of this.listeners) listener()
  }
  edit(id: number, key: string) {
    if (this.state.sealing) return
    this.update({ local: { ...this.state.local, [id]: key } })
  }
  enqueue(id: number) {
    const key = this.state.local[String(id)]
    if (!key || this.state.paused || this.state.sealing || this.state.saving[id] === key) return
    if (!this.latestSave.has(id) && this.state.view.attempt.answers[id] === key) {
      const local = { ...this.state.local }
      delete local[id]
      this.update({ local })
      return
    }
    const token = Symbol()
    this.latestSave.set(id, token)
    this.update({
      pending: this.state.pending + 1,
      saving: { ...this.state.saving, [id]: key },
      error: null,
    })
    this.tail = this.tail.then(async () => {
      try {
        if (this.state.paused) return
        const view = await this.service.saveAnswer(
            this.state.view.attempt.id,
            id,
            key,
            this.state.expectedVersion,
          ),
          local = { ...this.state.local }
        if (this.latestSave.get(id) === token && local[id] === key) delete local[id]
        this.update({ view, expectedVersion: view.attempt.version, local })
      } catch (error) {
        this.update({
          paused: true,
          error:
            error instanceof Error
              ? error
              : new Error('Answer could not be saved. Review the durable attempt.'),
          reviewed: null,
        })
      } finally {
        const saving = { ...this.state.saving }
        if (this.latestSave.get(id) === token) {
          this.latestSave.delete(id)
          delete saving[id]
        }
        this.update({ pending: this.state.pending - 1, saving })
      }
    })
  }
  async check() {
    if (this.state.pending || this.state.sealing)
      throw new Error('Wait for pending requests before reviewing saved answers.')
    const reviewed = await this.service.attempt(this.state.view.attempt.id)
    this.update({ reviewed })
    return reviewed
  }
  adopt(keepLocal: boolean) {
    const view = this.state.reviewed
    if (!view || this.state.pending || this.state.sealing) return
    const local = keepLocal
      ? Object.fromEntries(
          Object.entries(this.state.local).filter(([id, key]) => view.attempt.answers[id] !== key),
        )
      : {}
    this.update({
      view,
      expectedVersion: view.attempt.version,
      local,
      paused: false,
      error: null,
      reviewed: null,
    })
  }
  async seal() {
    if (this.state.sealing) throw new Error('Finalization request is already pending.')
    this.update({ sealing: true })
    try {
      await this.tail
      if (this.state.paused)
        throw new Error('A save is unresolved. Check saved answers and review before sealing.')
      const view = await this.service.seal(this.state.view.attempt.id, this.state.expectedVersion)
      this.update({ view, expectedVersion: view.attempt.version, local: {}, error: null })
      return view
    } catch (error) {
      this.update({
        paused: true,
        error:
          error instanceof Error
            ? error
            : new Error('Seal response is uncertain. Check saved attempt.'),
        reviewed: null,
      })
      throw error
    } finally {
      this.update({ sealing: false })
    }
  }
}
