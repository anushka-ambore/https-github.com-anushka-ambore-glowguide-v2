import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { CheckInForm } from './components/CheckInForm'
import { Icon, type IconName } from './components/Icon'
import { requestGeminiReflection } from './services/geminiAI'
import { clearAppData, loadAppData, saveAppData } from './storage/localStorage'
import type { AppData, CheckIn, Product, Profile, Reflection } from './types'
import './App.css'

type Page = 'Home' | 'Check-in' | 'Reflections' | 'Progress' | 'Products' | 'Profile'
const navigation: { name: Page; icon: IconName }[] = [
  { name: 'Home', icon: 'home' },
  { name: 'Check-in', icon: 'check' },
  { name: 'Reflections', icon: 'sparkles' },
  { name: 'Progress', icon: 'trend' },
  { name: 'Products', icon: 'products' },
  { name: 'Profile', icon: 'user' },
]

function getToday(): string {
  const date = new Date()
  return formatLocalDate(date)
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function makeId(): string {
  return crypto.randomUUID()
}

function getStreak(checkIns: CheckIn[]): number {
  const dates = new Set(checkIns.map((entry) => entry.date))
  const cursor = new Date(`${getToday()}T12:00:00`)
  let streak = 0
  while (dates.has(formatLocalDate(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function EntryCard({ entry, products }: { entry: CheckIn; products: Product[] }) {
  return (
    <article className="entry-card">
      <div className="entry-date"><strong>{new Date(`${entry.date}T12:00:00`).getDate()}</strong><span>{new Date(`${entry.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short' })}</span></div>
      <div className="entry-details">
        <strong>{entry.condition} · {entry.mood}</strong>
        <p>{entry.feeling || entry.note || 'A little check-in with your skin.'}</p>
        {entry.productIds.length > 0 && <div className="tag-row">{entry.productIds.map((id) => products.find((product) => product.id === id)?.name).filter(Boolean).map((name) => <span className="tag" key={name}>{name}</span>)}</div>}
      </div>
      {entry.photoDataUrl && <img className="entry-photo" src={entry.photoDataUrl} alt="Private check-in photo stored on this device" />}
      <span className="condition-tag">{entry.condition}</span>
    </article>
  )
}

function App() {
  const [initial] = useState(() => {
    try {
      return { data: loadAppData(), error: '' }
    } catch (error) {
      return {
        data: { profile: null, checkIns: [], products: [], reflections: [] } as AppData,
        error: error instanceof Error ? error.message : 'Could not load saved data.',
      }
    }
  })
  const [profile, setProfile] = useState<Profile | null>(initial.data.profile)
  const [checkIns, setCheckIns] = useState<CheckIn[]>(initial.data.checkIns)
  const [products, setProducts] = useState<Product[]>(initial.data.products)
  const [reflections, setReflections] = useState<Reflection[]>(initial.data.reflections)
  const [page, setPage] = useState<Page>(initial.data.profile ? 'Home' : 'Profile')
  const [storageError, setStorageError] = useState(initial.error)
  const [busyReflections, setBusyReflections] = useState<string[]>([])
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [compareId, setCompareId] = useState('')
  const initialSave = useRef(true)
  const reflectionRequestVersion = useRef(0)
  const [today] = useState(getToday)

  useEffect(() => {
    if (initialSave.current) {
      initialSave.current = false
      if (initial.error) return
    }
    if (!profile && checkIns.length === 0 && products.length === 0 && reflections.length === 0) return
    try {
      saveAppData({ profile, checkIns, products, reflections })
      setStorageError('')
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Could not save your data on this device.')
    }
  }, [profile, checkIns, products, reflections, initial.error])

  const sortedCheckIns = useMemo(() => [...checkIns].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), [checkIns])
  const todayEntry = sortedCheckIns.find((entry) => entry.date === today)
  const todayReflection = todayEntry ? reflections.find((reflection) => reflection.checkInId === todayEntry.id) : undefined
  const streak = getStreak(checkIns)
  const hasSavedData = Boolean(profile || checkIns.length || products.length || reflections.length)

  const generateReflection = async (entry: CheckIn) => {
    if (!profile || busyReflections.includes(entry.id)) return
    const requestVersion = reflectionRequestVersion.current
    setBusyReflections((current) => [...current, entry.id])
    setReflections((current) => [
      { checkInId: entry.id, status: 'pending', noticed: '', patterns: '', suggestions: [], createdAt: new Date().toISOString() },
      ...current.filter((reflection) => reflection.checkInId !== entry.id),
    ])
    try {
      const result = await requestGeminiReflection(profile, entry, sortedCheckIns.filter((item) => item.id !== entry.id).slice(0, 4), products)
      if (requestVersion !== reflectionRequestVersion.current) return
      setReflections((current) => [
        { checkInId: entry.id, ...result, status: 'complete', createdAt: new Date().toISOString() },
        ...current.filter((reflection) => reflection.checkInId !== entry.id),
      ])
    } catch (error) {
      if (requestVersion !== reflectionRequestVersion.current) return
      setReflections((current) => [
        { checkInId: entry.id, status: 'error', noticed: '', patterns: '', suggestions: [], error: error instanceof Error ? error.message : 'Reflection could not be generated.', createdAt: new Date().toISOString() },
        ...current.filter((reflection) => reflection.checkInId !== entry.id),
      ])
    } finally {
      setBusyReflections((current) => current.filter((id) => id !== entry.id))
    }
  }

  const deleteAllData = () => {
    if (!window.confirm('Delete your saved GlowGuide profile, check-ins, reflections, products, and photos from this browser? This cannot be undone.')) return
    try {
      clearAppData()
      reflectionRequestVersion.current += 1
      setProfile(null)
      setCheckIns([])
      setProducts([])
      setReflections([])
      setBusyReflections([])
      setPage('Profile')
      setStorageError('')
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Could not delete the saved GlowGuide data.')
    }
  }

  const saveCheckIn = async (entry: Omit<CheckIn, 'id' | 'createdAt'>) => {
    const completeEntry: CheckIn = { ...entry, id: makeId(), createdAt: new Date().toISOString() }
    setCheckIns((current) => [completeEntry, ...current])
    setPage('Reflections')
    await generateReflection(completeEntry)
  }

  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const displayName = String(form.get('displayName') || '').trim()
    if (!displayName) {
      const nameInput = event.currentTarget.elements.namedItem('displayName')
      if (nameInput instanceof HTMLInputElement) {
        nameInput.setCustomValidity('Please enter your name.')
        nameInput.reportValidity()
      }
      return
    }
    const nextProfile: Profile = {
      displayName,
      skinType: String(form.get('skinType')) as Profile['skinType'],
      concerns: form.getAll('concerns').map(String) as Profile['concerns'],
    }
    setProfile(nextProfile)
    if (!initial.data.profile) setPage('Home')
  }

  const saveProduct = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const product: Product = {
      id: editingProduct?.id ?? makeId(),
      name: String(form.get('name')).trim(),
      type: String(form.get('type')),
      dateStarted: String(form.get('dateStarted')),
      notes: String(form.get('notes')).trim(),
    }
    setProducts((current) => editingProduct ? current.map((item) => item.id === product.id ? product : item) : [product, ...current])
    setEditingProduct(null)
  }

  const title = !profile ? 'Profile setup' : page === 'Home' ? 'A little care, every day' : page
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setPage('Home')} aria-label="GlowGuide home">
          <img className="brand-logo" src="/glowguide-logo.svg" alt="" />
          <span className="brand-copy"><strong>GlowGuide <i>AI</i></strong><small>YOUR SKIN DIARY</small></span>
        </button>
        <nav className="nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <button key={item.name} className={page === item.name ? 'nav-item active' : 'nav-item'} disabled={!profile && item.name !== 'Profile'} onClick={() => setPage(item.name)}>
              <Icon name={item.icon} /><span>{item.name}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note"><Icon name="sparkles" /><p>Notice the little changes.<br />Understand your skin better.</p></div>
        {profile && <button className="profile-mini" onClick={() => setPage('Profile')}><span className="avatar">{profile.displayName.slice(0, 1).toUpperCase()}</span><span><strong>{profile.displayName}</strong><small>Your personal diary</small></span><Icon name="chevron" /></button>}
      </aside>

      <main className="main">
        <header className="topbar">
          <div><p className="eyebrow">{page === 'Home' ? dateLabel.toUpperCase() : 'GLOWGUIDE AI · SKIN REFLECTION COACH'}</p><h1>{page === 'Home' && profile ? `Hello, ${profile.displayName}` : title}<span className="title-sparkle"> ✦</span></h1></div>
          {profile && page !== 'Profile' && <button className="primary-button" onClick={() => setPage('Check-in')}><Icon name="plus" /> New check-in</button>}
        </header>

        <div className="tagline"><span className="tagline-leaf">✳</span> Notice the little changes. Understand your skin better.</div>
        {storageError && <div className="notice error-notice" role="alert">{storageError} Your changes may not persist after closing this tab.</div>}
        <div className="notice medical-notice"><Icon name="heart" /> GlowGuide AI is not a medical diagnostic tool. Reflections are supportive observations, not medical advice.</div>

        {!profile ? (
          <section className="panel onboarding-panel">
            <div className="section-intro"><span className="kicker">PROFILE SETUP</span><h2>A little about you.</h2><p>Share your name, how you'd describe your skin, and what you'd like to keep an eye on. These details help personalise your diary.</p></div>
            <ProfileForm onSubmit={saveProfile} />
          </section>
        ) : (
          <>
            {page === 'Home' && (
              <>
                <section className="home-grid">
                  <article className="panel today-card">
                    <div className="card-title-row"><div><span className="kicker">TODAY'S CHECK-IN</span><h2>{todayEntry ? 'You showed up for your skin.' : 'How is your skin feeling?'}</h2></div><div className="sun-icon"><Icon name="sun" /></div></div>
                    {todayEntry ? <><EntryCard entry={todayEntry} products={products} /><button className="subtle-button" onClick={() => setPage('Check-in')}>View check-in <Icon name="arrow" /></button></> : <><p className="muted-copy">A quick daily note can help you notice how things change, one day at a time.</p><button className="primary-button" onClick={() => setPage('Check-in')}><Icon name="plus" /> Start today's check-in</button></>}
                    <div className="streak-box"><span className="flame">✦</span><span><strong>{streak} day{streak === 1 ? '' : 's'}</strong><small>check-in streak</small></span><span className="streak-message">{streak ? 'Lovely consistency!' : 'Your first entry starts today'}</span></div>
                  </article>
                  <article className="panel reflection-home-card">
                    <div className="reflection-home-heading"><span className="reflection-mark"><Icon name="sparkles" /></span><span><small>A GENTLE MOMENT WITH</small><strong>GlowGuide AI</strong></span></div>
                    {todayReflection?.status === 'complete' ? <><p className="reflection-quote">{todayReflection.noticed}</p><button className="subtle-button" onClick={() => setPage('Reflections')}>Read your reflection <Icon name="arrow" /></button></> : todayReflection?.status === 'pending' ? <p className="muted-copy">GlowGuide AI is reflecting on your check-in…</p> : todayReflection?.status === 'error' ? <><p className="muted-copy">Your check-in is saved. The reflection could not be generated this time.</p><button className="text-button" onClick={() => void generateReflection(todayEntry!)}>Retry reflection</button></> : <><p className="reflection-quote">“Little observations can help you get to know your skin with more kindness.”</p><button className="subtle-button" onClick={() => setPage('Reflections')}>Explore reflections <Icon name="arrow" /></button></>}
                    <div className="leaf-ornament">✳</div>
                  </article>
                </section>
                <section className="section">
                  <div className="section-heading"><div><span className="kicker">YOUR RECENT NOTES</span><h2>Skin diary</h2></div><button className="text-button" onClick={() => setPage('Progress')}>Compare entries <Icon name="arrow" /></button></div>
                  {sortedCheckIns.length ? <div className="entry-list">{sortedCheckIns.slice(0, 4).map((entry) => <EntryCard key={entry.id} entry={entry} products={products} />)}</div> : <EmptyState text="Your diary is ready when you are. Add your first check-in to begin." />}
                </section>
              </>
            )}

            {page === 'Check-in' && <section className="panel form-panel"><div className="section-intro"><span className="kicker">A MOMENT FOR YOU</span><h2>How does your skin feel today?</h2><p>There's no right answer. Just notice what feels true for you.</p></div><CheckInForm products={products} onSubmit={saveCheckIn} /></section>}

            {page === 'Reflections' && (
              <section className="section">
                <div className="section-intro"><span className="kicker">A KINDER WAY TO NOTICE</span><h2>Your reflections</h2><p>Personal observations based on what you choose to record. Never a diagnosis.</p></div>
                {!sortedCheckIns.length ? <EmptyState text="Add a check-in and GlowGuide AI will create a personal reflection for you." /> : <div className="reflection-list">{sortedCheckIns.map((entry) => {
                  const reflection = reflections.find((item) => item.checkInId === entry.id)
                  return <ReflectionCard key={entry.id} entry={entry} reflection={reflection} busy={busyReflections.includes(entry.id)} onRetry={() => void generateReflection(entry)} />}
                )}</div>}
              </section>
            )}

            {page === 'Progress' && <ProgressPage checkIns={sortedCheckIns} compareId={compareId} onCompareChange={setCompareId} />}

            {page === 'Products' && (
              <section className="section products-page">
                <div className="section-intro"><span className="kicker">YOUR ROUTINE, IN ONE PLACE</span><h2>Product shelf</h2><p>Keep a simple record of products you use and when you started them.</p></div>
                <form key={editingProduct?.id ?? 'new'} className="panel product-form" onSubmit={saveProduct}>
                  <h3>{editingProduct ? 'Edit product' : 'Add a product'}</h3>
                  <div className="form-grid">
                    <label>Product name<input name="name" required defaultValue={editingProduct?.name ?? ''} placeholder="e.g. Daily moisturiser" /></label>
                    <label>Product type<select name="type" defaultValue={editingProduct?.type ?? 'Moisturiser'}>{['Cleanser','Moisturiser','Serum','Sunscreen','Treatment','Other'].map((type) => <option key={type}>{type}</option>)}</select></label>
                    <label>Date started<input name="dateStarted" type="date" defaultValue={editingProduct?.dateStarted ?? getToday()} /></label>
                    <label>Notes<input name="notes" defaultValue={editingProduct?.notes ?? ''} placeholder="Optional" /></label>
                  </div>
                  <div className="button-row"><button className="primary-button" type="submit">{editingProduct ? 'Save changes' : 'Add product'}</button>{editingProduct && <button type="button" className="subtle-button" onClick={() => setEditingProduct(null)}>Cancel</button>}</div>
                </form>
                {products.length ? <div className="product-list">{products.map((product) => <article className="panel product-card" key={product.id}><span className="product-icon"><Icon name="drop" /></span><div className="product-copy"><span className="kicker">{product.type} · STARTED {product.dateStarted || '—'}</span><h3>{product.name}</h3><p>{product.notes || 'No notes added.'}</p></div><button className="text-button" onClick={() => setEditingProduct(product)}>Edit</button><button className="icon-button danger" aria-label={`Delete ${product.name}`} onClick={() => { if (window.confirm(`Remove ${product.name} from your product shelf?`)) setProducts((current) => current.filter((item) => item.id !== product.id)) }}><Icon name="trash" /></button></article>)}</div> : <EmptyState text="Your product shelf is empty. Add products to choose them in a daily check-in." />}
              </section>
            )}

            {page === 'Profile' && <section className="panel form-panel"><div className="section-intro"><span className="kicker">PERSONALISE YOUR DIARY</span><h2>Your skin profile</h2><p>Your profile is used to give context to reflections. Change it whenever you like.</p></div><ProfileForm profile={profile} onSubmit={saveProfile} /></section>}
          </>
        )}
        {(page === 'Profile' || !profile) && hasSavedData && <DeleteDataPanel onDelete={deleteAllData} />}
        <footer className="app-footer"><span>Made for mindful skin days <span className="footer-sparkle">✦</span></span><span>Your diary stays on this device.</span></footer>
      </main>
    </div>
  )
}

function ProfileForm({ profile, onSubmit }: { profile?: Profile | null; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const types: Profile['skinType'][] = ['Oily', 'Dry', 'Combination', 'Normal', 'Sensitive']
  const concerns: Profile['concerns'][number][] = ['Acne', 'Dryness', 'Oiliness', 'Irritation', 'Dark spots']
  return <form className="profile-form" onSubmit={onSubmit}>
    <label>Your name<input name="displayName" required defaultValue={profile?.displayName ?? ''} onInput={(event) => event.currentTarget.setCustomValidity('')} placeholder="What should we call you?" /></label>
    <fieldset><legend>How would you describe your skin?</legend><div className="choice-grid">{types.map((type) => <label className="choice" key={type}><input type="radio" name="skinType" value={type} required defaultChecked={profile?.skinType === type} /><span>{type}</span></label>)}</div></fieldset>
    <fieldset><legend>What would you like to keep an eye on?</legend><div className="choice-grid concern-grid">{concerns.map((concern) => <label className="choice" key={concern}><input type="checkbox" name="concerns" value={concern} defaultChecked={profile?.concerns.includes(concern)} /><span>{concern}</span></label>)}</div></fieldset>
    <button className="primary-button" type="submit">{profile ? 'Save profile' : 'Create my profile'} <Icon name="arrow" /></button>
  </form>
}

function ReflectionCard({ entry, reflection, busy, onRetry }: { entry: CheckIn; reflection?: Reflection; busy: boolean; onRetry: () => void }) {
  return <article className="panel reflection-entry">
    <div className="reflection-entry-title"><div><span className="kicker">{new Date(`${entry.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span><h3>{entry.condition} · {entry.mood}</h3></div><span className="reflection-mark"><Icon name="sparkles" /></span></div>
    {!reflection || reflection.status === 'pending' || busy ? <p className="muted-copy">{busy ? 'GlowGuide AI is preparing a thoughtful reflection…' : 'No reflection yet.'}</p> : reflection.status === 'error' ? <div className="error-box"><p>{reflection.error}</p><button className="text-button" onClick={onRetry}>Retry reflection <Icon name="arrow" /></button></div> : <>
      <div className="reflection-section"><span>WHAT I NOTICED</span><p>{reflection.noticed}</p></div>
      {reflection.patterns && <div className="reflection-section"><span>A POSSIBLE PATTERN</span><p>{reflection.patterns}</p></div>}
      {reflection.suggestions.length > 0 && <div className="reflection-section"><span>A GENTLE IDEA</span><ul>{reflection.suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}</ul></div>}
      <small className="disclaimer">A supportive reflection, not a medical assessment.</small>
    </>}
  </article>
}

function ProgressPage({ checkIns, compareId, onCompareChange }: { checkIns: CheckIn[]; compareId: string; onCompareChange: (id: string) => void }) {
  const current = checkIns[0]
  const previous = checkIns.find((entry) => entry.id === compareId) ?? checkIns[1]
  const previousConcerns = previous ? previous.condition.toLowerCase() : ''
  return <section className="section">
    <div className="section-intro"><span className="kicker">A TIMELINE, NOT A SCORECARD</span><h2>Notice your changes</h2><p>Look back at the notes you chose to keep. Every skin day is different.</p></div>
    {current && <div className="panel compare-panel">
      <div className="compare-heading"><div><span className="kicker">SIDE-BY-SIDE</span><h3>Compare check-ins</h3></div><label>Compare with<select value={previous?.id ?? ''} onChange={(event) => onCompareChange(event.target.value)}>{checkIns.slice(1).map((entry) => <option key={entry.id} value={entry.id}>{new Date(`${entry.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</option>)}</select></label></div>
      {previous ? <div className="compare-columns"><CompareEntry entry={previous} label="THEN" /><div className="compare-change"><Icon name="sparkles" /><span>{previous.condition === current.condition ? 'Similar notes' : 'A little different'}</span></div><CompareEntry entry={current} label="MOST RECENT" /></div> : <EmptyState text="Add another check-in to see a side-by-side comparison." />}
      {previous && <div className="trend-note"><Icon name="heart" /> Your notes mention <strong>{previousConcerns === current.condition.toLowerCase() ? 'the same skin condition' : `${current.condition.toLowerCase()} today and ${previous.condition.toLowerCase()} before`}.</strong> Changes can have many causes; this is just a way to notice your own entries.</div>}
    </div>}
    <div className="section-heading timeline-heading"><div><span className="kicker">CONDITION PATTERNS</span><h2>Notes across your entries</h2></div></div>
    {checkIns.length > 0 && <div className="panel condition-summary">{[...new Set(checkIns.map((entry) => entry.condition))].map((condition) => {
      const count = checkIns.filter((entry) => entry.condition === condition).length
      return <div className="condition-summary-row" key={condition}><span>{condition}</span><div className="condition-track"><i style={{ width: `${(count / checkIns.length) * 100}%` }} /></div><strong>{count}</strong></div>
    })}</div>}
    <div className="section-heading timeline-heading"><div><span className="kicker">YOUR ENTRIES</span><h2>Timeline</h2></div></div>
    {checkIns.length ? <div className="timeline">{checkIns.map((entry) => <div className="timeline-item" key={entry.id}><span className="timeline-dot" /><span className="timeline-date">{new Date(`${entry.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span><EntryCard entry={entry} products={[]} /></div>)}</div> : <EmptyState text="Your timeline will appear after your first check-in." />}
  </section>
}

function CompareEntry({ entry, label }: { entry: CheckIn; label: string }) {
  return <div className="compare-entry"><span className="kicker">{label} · {new Date(`${entry.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span><h4>{entry.condition}</h4><p>{entry.feeling || 'No feeling note added.'}</p><span className="mood-pill">{entry.mood}</span>{entry.note && <blockquote>{entry.note}</blockquote>}</div>
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name="leafSparkle" /></span><p>{text}</p></div>
}

function DeleteDataPanel({ onDelete }: { onDelete: () => void }) {
  return <section className="danger-zone">
    <div><h2>Delete your data</h2><p>Remove your saved profile, check-ins, reflections, products, and photos from this browser. This won't delete information already sent to Google Gemini.</p></div>
    <button className="danger-button" type="button" onClick={onDelete}>Delete all my data</button>
  </section>
}

export default App
