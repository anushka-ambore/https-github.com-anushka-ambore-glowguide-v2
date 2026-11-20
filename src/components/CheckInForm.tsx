import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Icon } from './Icon'
import type { CheckIn, Product } from '../types'

const maxPhotoSize = 1_500_000

function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read the selected photo.'))
    reader.onerror = () => reject(new Error('Could not read the selected photo.'))
    reader.readAsDataURL(file)
  })
}

export function CheckInForm({ products, onSubmit }: { products: Product[]; onSubmit: (entry: Omit<CheckIn, 'id' | 'createdAt'>) => Promise<void> }) {
  const [today] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10))
  const [condition, setCondition] = useState('')
  const [mood, setMood] = useState('')
  const [photo, setPhoto] = useState<string | undefined>()
  const [photoName, setPhotoName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    const form = new FormData(event.currentTarget)
    try {
      await onSubmit({
        date: String(form.get('date')),
        condition: String(form.get('condition')) as CheckIn['condition'],
        feeling: String(form.get('feeling')).trim(),
        mood: String(form.get('mood')) as CheckIn['mood'],
        productIds: form.getAll('productIds').map(String),
        note: String(form.get('note')).trim(),
        ...(photo ? { photoDataUrl: photo } : {}),
      })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save this check-in.')
      setSaving(false)
    }
  }

  const changePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file for your optional photo.')
      return
    }
    if (file.size > maxPhotoSize) {
      setError('Choose a photo smaller than 1.5 MB so it can be stored on this device.')
      event.target.value = ''
      return
    }
    try {
      setPhoto(await readPhoto(file))
      setPhotoName(file.name)
      setError('')
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : 'Could not read the selected photo.')
    }
  }

  return <form className="checkin-form" onSubmit={submit}>
    <div className="form-grid">
      <label>Date<input type="date" name="date" required defaultValue={today} /></label>
      <label>What are you noticing?<select name="condition" required value={condition} onChange={(event) => setCondition(event.target.value)}><option value="">Select a skin condition</option>{['Clear','Breakout','Dry','Oily','Irritated','Other'].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>How does it feel?<input name="feeling" required placeholder="A short note about how your skin feels" /></label>
      <label>Pick a feeling<select name="mood" required value={mood} onChange={(event) => setMood(event.target.value)}><option value="">Select a feeling</option>{['Calm','Comfortable','Tight','Itchy','Tender','Frustrated'].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="wide-field">Anything else you'd like to remember?<textarea name="note" rows={3} placeholder="Optional note for your diary..." /></label>
      {products.length > 0 && <fieldset className="wide-field"><legend>Products used today <span>(optional)</span></legend><div className="product-checklist">{products.map((product) => <label key={product.id}><input type="checkbox" name="productIds" value={product.id} /><span>{product.name}</span></label>)}</div></fieldset>}
      <div className="wide-field photo-field"><label htmlFor="photo">Add an optional photo <span>(stored on this device only — never sent to AI)</span></label><input id="photo" type="file" accept="image/*" onChange={(event) => void changePhoto(event)} />{photoName && <span className="photo-name">{photoName} <button type="button" className="text-button" onClick={() => { setPhoto(undefined); setPhotoName('') }}>Remove</button></span>}{photo && <img className="photo-preview" src={photo} alt="Your selected check-in photo" />}</div>
    </div>
    {error && <div className="notice error-notice" role="alert">{error}</div>}
    <div className="privacy-note"><Icon name="heart" /> Your notes stay in this browser. Check-in photos are kept on your device and excluded from AI reflections.</div>
    <button className="primary-button submit-checkin" type="submit" disabled={saving}>{saving ? 'Saving your check-in…' : 'Save check-in and reflect'} <Icon name="arrow" /></button>
  </form>
}
