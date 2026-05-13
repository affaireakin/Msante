'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface AmiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  isCrisis?: boolean
}

const CRISIS_KEYWORDS_REGEX =
  /\b(suicide|suicidaire|me tuer|mourir|mort|plus envie de vivre|en finir|disparaître|disparaitre|me faire du mal|me blesser|crisis|crise|urgence)\b/i

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return (
    <span className="material-symbols-outlined" style={{ fontSize: '20px', ...style }}>
      {name}
    </span>
  )
}

function ChatBubble({ message }: { message: AmiMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-[#006685] flex items-center justify-center mr-2 flex-shrink-0 mt-1">
          <Icon name="favorite" style={{ fontSize: '14px', color: '#fff' }} />
        </div>
      )}
      <div
        style={{
          maxWidth: '72%',
          padding: '12px 16px',
          borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
          backgroundColor: isUser ? '#006685' : 'rgba(229,238,255,0.80)',
          border: isUser ? 'none' : '1px solid rgba(255,255,255,0.80)',
          backdropFilter: isUser ? 'none' : 'blur(8px)',
        }}
      >
        <p
          className="text-sm leading-relaxed whitespace-pre-wrap"
          style={{ color: isUser ? '#fff' : '#0b1c30', fontFamily: 'Manrope' }}
        >
          {message.content}
        </p>
      </div>
    </div>
  )
}

function CrisisBanner() {
  return (
    <div
      className="mx-4 my-3 p-4 rounded-2xl flex items-start gap-3"
      style={{
        backgroundColor: '#ffdad6',
        border: '1px solid #ba1a1a30',
      }}
    >
      <div className="w-8 h-8 rounded-full bg-[#ba1a1a] flex items-center justify-center flex-shrink-0">
        <Icon name="emergency" style={{ fontSize: '16px', color: '#fff' }} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold text-[#930009]" style={{ fontFamily: 'Manrope' }}>
          Besoin d&apos;aide immédiate ?
        </p>
        <p className="text-xs text-[#ba1a1a] mt-0.5" style={{ fontFamily: 'Manrope' }}>
          SOS Amitié Sénégal :{' '}
          <strong>+221 33 823 8020</strong> — disponible 24h/24
        </p>
        <p className="text-xs text-[#ba1a1a] mt-0.5" style={{ fontFamily: 'Manrope' }}>
          Ou consultez un praticien M-Santé maintenant.
        </p>
      </div>
    </div>
  )
}

function WelcomeState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-8">
      <div
        className="w-32 h-32 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: '#006685',
          boxShadow: '0 0 60px 20px rgba(130,216,255,0.30)',
        }}
      >
        <Icon name="waves" style={{ fontSize: '52px', color: '#fff' }} />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-[#0b1c30]" style={{ fontFamily: 'Manrope' }}>
          Comment vous sentez-vous ?
        </h2>
        <p className="text-[#6f787e]" style={{ fontFamily: 'Manrope' }}>
          Je vous écoute...
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {[
          { icon: 'self_improvement', label: 'Gérer mon stress' },
          { icon: 'bedtime', label: 'Troubles du sommeil' },
          { icon: 'sentiment_sad', label: 'Sentiment de tristesse' },
          { icon: 'medical_services', label: 'Parler à un praticien' },
        ].map((card) => (
          <div
            key={card.label}
            className="p-4 rounded-2xl text-center cursor-pointer hover:shadow-md transition-all"
            style={{
              backgroundColor: 'rgba(255,255,255,0.70)',
              border: '1px solid rgba(255,255,255,0.80)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <Icon name={card.icon} style={{ fontSize: '28px', color: '#006685' }} />
            <p className="text-xs font-semibold text-[#0b1c30] mt-2" style={{ fontFamily: 'Manrope' }}>
              {card.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<AmiMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showCrisis, setShowCrisis] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: AmiMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    if (CRISIS_KEYWORDS_REGEX.test(text)) setShowCrisis(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ami-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ messages: history }),
        }
      )

      if (!res.ok) throw new Error('Request failed')
      const { text: replyText, isCrisis } = await res.json() as { text: string; isCrisis: boolean }

      if (isCrisis) setShowCrisis(true)

      setMessages(prev => [
        ...prev,
        { id: `a_${Date.now()}`, role: 'assistant', content: replyText, timestamp: Date.now(), isCrisis },
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: 'Je suis temporairement indisponible. Réessayez dans quelques instants. 💙',
          timestamp: Date.now(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    await sendMessage(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-bold text-[#006685] uppercase tracking-widest" style={{ fontFamily: 'Manrope' }}>
            M-Santé
          </p>
          <h1 className="text-2xl font-black text-[#0b1c30] flex items-center gap-2" style={{ fontFamily: 'Manrope' }}>
            Ami
            <Icon name="favorite" style={{ fontSize: '22px', color: '#006685' }} />
          </h1>
        </div>
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold"
          style={{ backgroundColor: '#e8f5e9', color: '#1d7a3a', border: '1px solid #bbf7d0' }}
        >
          <div className="w-2 h-2 rounded-full bg-[#1d7a3a]" />
          Disponible
        </div>
      </div>

      {/* Chat area */}
      <div
        className="flex-1 rounded-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: 'rgba(255,255,255,0.60)',
          border: '1px solid rgba(255,255,255,0.80)',
          backdropFilter: 'blur(16px)',
          minHeight: 0,
        }}
      >
        <div className="flex-1 overflow-y-auto p-6">
          {messages.length === 0 ? (
            <WelcomeState />
          ) : (
            <>
              {messages.map(msg => (
                <ChatBubble key={msg.id} message={msg} />
              ))}
              {showCrisis && <CrisisBanner />}
              {isLoading && (
                <div className="flex justify-start mb-2">
                  <div className="w-8 h-8 rounded-full bg-[#006685] flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                    <Icon name="favorite" style={{ fontSize: '14px', color: '#fff' }} />
                  </div>
                  <div
                    className="px-5 py-3 rounded-2xl rounded-tl-sm"
                    style={{
                      backgroundColor: 'rgba(229,238,255,0.80)',
                      border: '1px solid rgba(255,255,255,0.80)',
                    }}
                  >
                    <div className="flex gap-1 items-center">
                      {[0, 150, 300].map(delay => (
                        <div
                          key={delay}
                          className="w-2 h-2 rounded-full bg-[#006685] animate-bounce"
                          style={{ animationDelay: `${delay}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Disclaimer */}
        <div className="px-6 py-2 border-t border-slate-100/60">
          <p className="text-xs text-center text-[#6f787e]" style={{ fontFamily: 'Manrope' }}>
            Cet espace ne remplace pas un professionnel de santé
          </p>
        </div>

        {/* Input */}
        <div
          className="px-4 py-4 border-t border-slate-100/60 flex items-end gap-3"
        >
          <div
            className="flex-1 flex items-end gap-3 rounded-2xl px-4 py-3"
            style={{
              backgroundColor: 'rgba(220,233,255,0.90)',
              border: '1px solid rgba(255,255,255,0.60)',
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Partagez ce que vous ressentez..."
              rows={1}
              maxLength={500}
              className="flex-1 bg-transparent text-sm text-[#0b1c30] placeholder-[#6f787e] outline-none resize-none leading-relaxed"
              style={{ fontFamily: 'Manrope', maxHeight: '120px' }}
            />
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0"
              style={{
                backgroundColor: input.trim() && !isLoading ? '#006685' : '#bec8ce',
                cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
              }}
            >
              <Icon name="send" style={{ fontSize: '18px', color: '#fff' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
