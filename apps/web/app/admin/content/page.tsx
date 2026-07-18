'use client'
import { useEffect, useRef, useState } from 'react'
import { useSiteSettings, useContentPages, useFaqAdmin } from './useContent'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

function SiteSettingsTab() {
  const { settings, save, uploadLogo } = useSiteSettings()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    phone: '', whatsapp_number: '', contact_email: '',
    facebook_url: '', instagram_url: '', twitter_url: '', linkedin_url: '', tiktok_url: '', youtube_url: '',
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!settings.data) return
    setForm({
      phone: settings.data.phone ?? '',
      whatsapp_number: settings.data.whatsapp_number ?? '',
      contact_email: settings.data.contact_email ?? '',
      facebook_url: settings.data.facebook_url ?? '',
      instagram_url: settings.data.instagram_url ?? '',
      twitter_url: settings.data.twitter_url ?? '',
      linkedin_url: settings.data.linkedin_url ?? '',
      tiktok_url: settings.data.tiktok_url ?? '',
      youtube_url: settings.data.youtube_url ?? '',
    })
  }, [settings.data])

  const handleSave = () => {
    save.mutate(form, { onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2500) } })
  }

  const field = (key: keyof typeof form, label: string, placeholder: string) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">{label}</label>
      <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-sm text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#82d8ff]" />
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-5 flex items-center gap-4" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
        <div className="w-16 h-16 rounded-xl bg-[#e5eeff] flex items-center justify-center overflow-hidden flex-shrink-0 border border-[#d3e4fe]">
          {settings.data?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.data.logo_url} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <Icon name="medical_services" style={{ fontSize: '28px', color: '#005e7a' }} />
          )}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-[#0b1c30] text-sm">Logo M-Santé</p>
          <p className="text-xs text-[#6f787e] mt-0.5">Affiché dans l&apos;en-tête et le pied de page du site public</p>
        </div>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo.mutate(f) }} />
        <button onClick={() => fileInputRef.current?.click()} disabled={uploadLogo.isPending}
          className="px-4 py-2 bg-[#82d8ff] text-[#0b1c30] text-sm font-bold rounded-xl disabled:opacity-50 flex-shrink-0">
          {uploadLogo.isPending ? 'Envoi...' : 'Changer le logo'}
        </button>
      </div>

      <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
        <h3 className="text-sm font-bold text-[#0b1c30]">Contact</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field('phone', 'Téléphone', '+221 33 000 00 00')}
          {field('whatsapp_number', 'WhatsApp', '+221 77 000 00 00')}
          {field('contact_email', 'Email de contact', 'contact@m-sante.com')}
        </div>
      </div>

      <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
        <h3 className="text-sm font-bold text-[#0b1c30]">Réseaux sociaux</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field('facebook_url', 'Facebook', 'https://facebook.com/msante')}
          {field('instagram_url', 'Instagram', 'https://instagram.com/msante')}
          {field('twitter_url', 'X (Twitter)', 'https://x.com/msante_sn')}
          {field('linkedin_url', 'LinkedIn', 'https://linkedin.com/company/msante')}
          {field('tiktok_url', 'TikTok', 'https://tiktok.com/@msante')}
          {field('youtube_url', 'YouTube', 'https://youtube.com/@msante')}
        </div>
      </div>

      <button onClick={handleSave} disabled={save.isPending}
        className="px-5 py-2.5 rounded-xl text-sm font-bold text-[#0b1c30] disabled:opacity-50"
        style={{ backgroundColor: saved ? '#1d7a3a' : '#82d8ff', color: saved ? '#fff' : '#0b1c30' }}>
        {save.isPending ? 'Sauvegarde...' : saved ? 'Sauvegardé !' : 'Sauvegarder'}
      </button>
    </div>
  )
}

// Pages système avec une route dédiée (pas /pages/[slug]) — utile pour
// afficher le bon chemin public dans l'éditeur.
const KNOWN_ROUTES: Record<string, string> = { cgu: '/cgu' }

function PagesTab() {
  const { pages, save, create, remove } = useContentPages()
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saved, setSaved] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newSlug, setNewSlug] = useState('')
  const [newTitle, setNewTitle] = useState('')

  useEffect(() => {
    if (!selectedSlug && (pages.data ?? []).length > 0) setSelectedSlug(pages.data![0].slug)
  }, [pages.data, selectedSlug])

  const selected = (pages.data ?? []).find(p => p.slug === selectedSlug) ?? null

  useEffect(() => {
    if (selected) { setTitle(selected.title); setBody(selected.body) }
  }, [selected])

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    const slug = newSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
    if (!slug || !newTitle.trim()) return
    create.mutate({ slug, title: newTitle.trim() }, {
      onSuccess: () => { setShowNew(false); setNewSlug(''); setNewTitle(''); setSelectedSlug(slug) },
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
      <div className="space-y-3">
        <button onClick={() => setShowNew(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-[#0b1c30]"
          style={{ backgroundColor: '#82d8ff' }}>
          + Nouvelle page
        </button>
        <div className="space-y-2">
          {(pages.data ?? []).map(p => (
            <button key={p.slug} onClick={() => setSelectedSlug(p.slug)}
              className="w-full text-left px-4 py-3 rounded-xl transition-all"
              style={{
                backgroundColor: selectedSlug === p.slug ? 'rgba(130,216,255,0.15)' : 'rgba(255,255,255,0.70)',
                border: selectedSlug === p.slug ? '1px solid #82d8ff' : '1px solid rgba(255,255,255,0.80)',
              }}>
              <p className="text-sm font-bold text-[#0b1c30]">{p.title}</p>
              <p className="text-xs text-[#6f787e] mt-0.5">{KNOWN_ROUTES[p.slug] ?? `/pages/${p.slug}`}</p>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="rounded-2xl p-5 space-y-3" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <div className="flex items-center justify-between">
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="text-sm font-bold text-[#0b1c30] bg-transparent border-b border-transparent focus:border-[#82d8ff] outline-none flex-1" />
            <button onClick={() => { if (confirm('Supprimer cette page ?')) remove.mutate(selected.slug) }} className="text-[#ba1a1a] hover:bg-red-50 p-1.5 rounded-lg">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
            </button>
          </div>
          <p className="text-xs text-[#6f787e]">
            Page publique : <strong>{KNOWN_ROUTES[selected.slug] ?? `/pages/${selected.slug}`}</strong> · HTML simple accepté (h2, p, ul/li, strong)
          </p>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={18}
            className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-xs text-[#0b1c30] font-mono focus:outline-none focus:border-[#82d8ff] resize-y" />
          <button onClick={() => save.mutate({ slug: selected.slug, title, body }, { onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2500) } })}
            disabled={save.isPending}
            className="px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ backgroundColor: saved ? '#1d7a3a' : '#82d8ff', color: saved ? '#fff' : '#0b1c30' }}>
            {save.isPending ? 'Sauvegarde...' : saved ? 'Sauvegardé !' : 'Sauvegarder'}
          </button>
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-[#0b1c30]">Nouvelle page</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#0b1c30] mb-1.5">Titre</label>
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:border-[#82d8ff]"
                  placeholder="Ex : Programme partenaires" />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#0b1c30] mb-1.5">Identifiant (slug)</label>
                <input value={newSlug} onChange={e => setNewSlug(e.target.value)}
                  className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:border-[#82d8ff]"
                  placeholder="Ex : programme-partenaires" />
                <p className="text-xs text-[#6f787e] mt-1">Sera publiée sur /pages/{newSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') || '...'}</p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowNew(false)} className="flex-1 border-2 border-slate-200 text-[#0b1c30] rounded-xl py-2.5 text-sm font-bold hover:bg-slate-50">
                  Annuler
                </button>
                <button type="submit" disabled={create.isPending} className="flex-1 bg-[#82d8ff] text-[#0b1c30] rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
                  {create.isPending ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function FaqTab() {
  const { items, create, update, remove } = useFaqAdmin()
  const [showNew, setShowNew] = useState(false)
  const [newQ, setNewQ] = useState('')
  const [newA, setNewA] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editQ, setEditQ] = useState('')
  const [editA, setEditA] = useState('')

  const startEdit = (item: { id: string; question: string; answer: string }) => {
    setEditing(item.id); setEditQ(item.question); setEditA(item.answer)
  }

  return (
    <div className="space-y-4">
      <button onClick={() => setShowNew(v => !v)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-[#0b1c30]"
        style={{ backgroundColor: '#82d8ff' }}>
        <Icon name="add" style={{ fontSize: '18px' }} />
        Nouvelle question
      </button>

      {showNew && (
        <div className="rounded-2xl p-5 space-y-3" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <input value={newQ} onChange={e => setNewQ(e.target.value)} placeholder="Question"
            className="w-full px-4 py-2.5 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-sm text-[#0b1c30] focus:outline-none focus:border-[#82d8ff]" />
          <textarea value={newA} onChange={e => setNewA(e.target.value)} rows={3} placeholder="Réponse"
            className="w-full px-4 py-2.5 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-sm text-[#0b1c30] focus:outline-none focus:border-[#82d8ff] resize-none" />
          <button onClick={() => { if (newQ.trim() && newA.trim()) { create.mutate({ question: newQ.trim(), answer: newA.trim() }); setNewQ(''); setNewA(''); setShowNew(false) } }}
            className="px-4 py-2 rounded-xl text-sm font-bold text-[#0b1c30]" style={{ backgroundColor: '#82d8ff' }}>
            Ajouter
          </button>
        </div>
      )}

      <div className="space-y-3">
        {(items.data ?? []).map(item => (
          <div key={item.id} className="rounded-2xl p-5 space-y-2" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
            {editing === item.id ? (
              <div className="space-y-2">
                <input value={editQ} onChange={e => setEditQ(e.target.value)}
                  className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-sm text-[#0b1c30] focus:outline-none focus:border-[#82d8ff]" />
                <textarea value={editA} onChange={e => setEditA(e.target.value)} rows={3}
                  className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-sm text-[#0b1c30] focus:outline-none focus:border-[#82d8ff] resize-none" />
                <div className="flex gap-2">
                  <button onClick={() => { update.mutate({ id: item.id, question: editQ, answer: editA }); setEditing(null) }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#0b1c30]" style={{ backgroundColor: '#82d8ff' }}>Sauvegarder</button>
                  <button onClick={() => setEditing(null)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#6f787e] border border-slate-200">Annuler</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold text-[#0b1c30] text-sm">{item.question}</p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => update.mutate({ id: item.id, is_published: !item.is_published })}
                      className="text-xs font-semibold px-2 py-1 rounded-full"
                      style={{ backgroundColor: item.is_published ? '#e8f5e9' : '#f1f5f9', color: item.is_published ? '#1d7a3a' : '#6f787e' }}>
                      {item.is_published ? 'Publié' : 'Masqué'}
                    </button>
                    <button onClick={() => startEdit(item)} className="text-[#82d8ff]"><Icon name="edit" style={{ fontSize: '16px' }} /></button>
                    <button onClick={() => { if (confirm('Supprimer cette question ?')) remove.mutate(item.id) }} className="text-[#ba1a1a]"><Icon name="delete" style={{ fontSize: '16px' }} /></button>
                  </div>
                </div>
                <p className="text-sm text-[#3f484d]">{item.answer}</p>
              </>
            )}
          </div>
        ))}
        {(items.data ?? []).length === 0 && <p className="text-sm text-[#bec8ce] text-center py-6">Aucune question</p>}
      </div>
    </div>
  )
}

export default function AdminContentPage() {
  const [tab, setTab] = useState<'settings' | 'pages' | 'faq'>('settings')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0b1c30]">Contenu du site</h1>
        <p className="text-sm text-[#6f787e] mt-0.5">Logo, contact, réseaux sociaux, pages et FAQ</p>
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-white/60 w-fit" style={{ border: '1px solid rgba(255,255,255,0.80)' }}>
        {(['settings', 'pages', 'faq'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-sm font-bold transition-all"
            style={{ backgroundColor: tab === t ? '#82d8ff' : 'transparent', color: tab === t ? '#fff' : '#6f787e' }}>
            {t === 'settings' ? 'Paramètres du site' : t === 'pages' ? 'Pages' : 'FAQ'}
          </button>
        ))}
      </div>

      {tab === 'settings' && <SiteSettingsTab />}
      {tab === 'pages' && <PagesTab />}
      {tab === 'faq' && <FaqTab />}
    </div>
  )
}
