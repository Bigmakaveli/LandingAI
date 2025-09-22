import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// ===== CONSTANTS =====
const BUTTON_SIZE = 56
const DEFAULT_MARGIN = 20
const PANEL_WIDTH = 400
const PANEL_HEIGHT_RATIO = 0.7
const MAX_PANEL_HEIGHT = 520

// ===== CSS KEYFRAMES =====
const typingKeyframes = `
  @keyframes typing {
    0%, 60%, 100% {
      transform: translateY(0);
      opacity: 0.4;
    }
    30% {
      transform: translateY(-10px);
      opacity: 1;
    }
  }
`

// ===== TYPES =====
type ChatOverlayProps = { siteId?: string }

type AttachmentImage = { kind: 'image', name: string, url: string }
type AttachmentText = { kind: 'text', name: string, content: string }
type AttachmentEditedFile = { kind: 'editedFile', name: string, content: string, url: string }
type Attachment = AttachmentImage | AttachmentText | AttachmentEditedFile
type UiMessage = { id: number, role: 'user' | 'assistant' | 'system', text?: string, attachments?: Attachment[] }

type Position = { x: number, y: number }
type DragOffset = { dx: number, dy: number }

// ===== UTILITY FUNCTIONS =====

async function uploadImageToStorage(base64Image: string): Promise<string> {
  const apiKey = 'ff82973570dabcfac99886b2b60d5388'
  
  try {
    const formData = new FormData()
    formData.append('image', base64Image)
    
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!data.success) {
      throw new Error(data.error?.message || 'Failed to upload image')
    }
    
    return data.data.url
  } catch (error) {
    console.error('Image upload error:', error)
    throw new Error('Failed to upload image to storage')
  }
}

function buildApiMessages(uiMessages: UiMessage[]) {
  return uiMessages.map(m => {
    const hasAttachments = Array.isArray(m.attachments) && m.attachments.length > 0
    if (!hasAttachments) {
      return { role: m.role, content: m.text || '' }
    }
    
    const contentParts: any[] = []
    if (m.text && m.text.trim()) {
      contentParts.push({ type: 'text', text: m.text })
    }
    
    m.attachments!.forEach(att => {
      if (att.kind === 'image') {
        contentParts.push({ type: 'image_url', image_url: { url: att.url } })
      } else if (att.kind === 'text') {
        const header = att.name ? `File ${att.name}:\n` : ''
        contentParts.push({ type: 'text', text: `${header}${att.content}` })
      }
    })
    
    return { role: m.role, content: contentParts }
  })
}

function clampPosition(pos: number, min: number, max: number): number {
  return Math.min(Math.max(min, pos), max)
}

function calculatePanelPosition(launcherPos: Position, windowWidth: number, windowHeight: number): Position {
  const panelHeight = Math.min(Math.floor(PANEL_HEIGHT_RATIO * windowHeight), MAX_PANEL_HEIGHT)
  const candidateLeft = launcherPos.x + BUTTON_SIZE - PANEL_WIDTH
  const candidateTop = launcherPos.y + BUTTON_SIZE - panelHeight
  
  return {
    x: clampPosition(candidateLeft, DEFAULT_MARGIN, windowWidth - PANEL_WIDTH - DEFAULT_MARGIN),
    y: clampPosition(candidateTop, DEFAULT_MARGIN, windowHeight - panelHeight - DEFAULT_MARGIN)
  }
}

// ===== CUSTOM HOOKS =====

function useSiteStatus(siteId?: string, onStatusReady?: () => void) {
  const [siteStatus, setSiteStatus] = useState<'READY' | 'UNDER_DEV' | 'UNKNOWN'>('UNKNOWN')
  const [isPolling, setIsPolling] = useState(false)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const checkSiteStatus = async () => {
    if (!siteId) return

    try {
      console.log('Checking site status for:', siteId)
      const response = await fetch(`/api/${siteId}/site-status`)
      if (response.ok) {
        const data = await response.json()
        console.log('Site status response:', data)
        setSiteStatus(data.status || 'UNKNOWN')
        return data.status
      } else {
        console.error('Site status check failed:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Failed to check site status:', error)
    }
    return 'UNKNOWN'
  }

  const startPolling = () => {
    if (isPolling || !siteId) return
    
    console.log('Starting polling for site status...')
    setIsPolling(true)
    pollingIntervalRef.current = setInterval(async () => {
      console.log('Polling site status...')
      const status = await checkSiteStatus()
      console.log('Polled status:', status)
      if (status === 'READY') {
        console.log('Status is READY, stopping polling and calling onStatusReady')
        stopPolling()
        // Call the callback to reload history
        if (onStatusReady) {
          console.log('🔄 Calling onStatusReady callback to reload history')
          onStatusReady()
        }
      }
    }, 2000) // Poll every 2 seconds
  }

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    setIsPolling(false)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [])

  // Check status when siteId changes
  useEffect(() => {
    if (siteId) {
      checkSiteStatus()
    }
  }, [siteId])

  return {
    siteStatus,
    isPolling,
    checkSiteStatus,
    startPolling,
    stopPolling
  }
}

function usePositioning() {
  const [launcherPos, setLauncherPos] = useState<Position | null>(null)
  const [panelPos, setPanelPos] = useState<Position | null>(null)
  
  const initializeLauncherPosition = () => {
    try {
      const h = window.innerHeight
      setLauncherPos({ 
        x: Math.max(0, DEFAULT_MARGIN), 
        y: Math.max(0, h - DEFAULT_MARGIN - BUTTON_SIZE) 
      })
    } catch {}
  }
  
  const updatePositionsOnResize = () => {
    setLauncherPos(pos => {
      if (!pos) return pos
      const w = window.innerWidth
      const h = window.innerHeight
      return {
        x: clampPosition(pos.x, 0, w - BUTTON_SIZE),
        y: clampPosition(pos.y, 0, h - BUTTON_SIZE)
      }
    })
    
    setPanelPos(pos => {
      if (!pos) return pos
      const w = window.innerWidth
      const h = window.innerHeight
      const panelHeight = Math.min(Math.floor(PANEL_HEIGHT_RATIO * h), MAX_PANEL_HEIGHT)
      return {
        x: clampPosition(pos.x, DEFAULT_MARGIN, w - PANEL_WIDTH - DEFAULT_MARGIN),
        y: clampPosition(pos.y, DEFAULT_MARGIN, h - panelHeight - DEFAULT_MARGIN)
      }
    })
  }
  
  return {
    launcherPos,
    setLauncherPos,
    panelPos,
    setPanelPos,
    initializeLauncherPosition,
    updatePositionsOnResize
  }
}

function useDragging() {
  const [isDragging, setIsDragging] = useState(false)
  const [isPanelDragging, setIsPanelDragging] = useState(false)
  const dragOffsetRef = useRef<DragOffset>({ dx: 0, dy: 0 })
  const panelDragOffsetRef = useRef<DragOffset>({ dx: 0, dy: 0 })
  const didDragRef = useRef(false)
  
  return {
    isDragging,
    setIsDragging,
    isPanelDragging,
    setIsPanelDragging,
    dragOffsetRef,
    panelDragOffsetRef,
    didDragRef
  }
}

function useChatHistory(siteId?: string, onHistoryLoaded?: () => void) {
  const [messages, setMessages] = useState<UiMessage[]>([
    { id: 1, role: 'assistant', text: 'Hi! I can help modify this site.' }
  ])
  
  const loadHistory = useCallback(async () => {
    if (!siteId) {
      console.warn('ChatOverlay: siteId is required for chat functionality')
      return
    }
    
    console.log('🔄 loadHistory called for siteId:', siteId)
    
    try {
      const url = `/api/${siteId}/chat/history`
      console.log('📡 Fetching from URL:', url)
      // Add cache-busting parameter to ensure we get fresh data
      const cacheBustUrl = `${url}?t=${Date.now()}`
      console.log('📡 Cache-busted URL:', cacheBustUrl)
      const response = await fetch(cacheBustUrl, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      const data = await response.json()
      
      console.log('📦 Raw response data:', data)
      
      const history = Array.isArray(data?.history) ? data.history : []
      console.log('📝 Processing history:', history.length, 'messages')
      
      if (history.length) {
        const uiMsgs: UiMessage[] = history.map((m: any, idx: number) => {
          const role = m.role || 'assistant'
          const content = m.content || ''
          
          // Handle complex content structure with attachments
          if (Array.isArray(content)) {
            const textParts: string[] = []
            const attachments: Attachment[] = []
            
            content.forEach((part: any) => {
              if (part.type === 'text' && part.text) {
                textParts.push(part.text)
              } else if (part.type === 'image_url' && part.image_url) {
                const url = typeof part.image_url === 'string' ? part.image_url : part.image_url.url
                if (url) {
                  attachments.push({
                    kind: 'image',
                    name: `Image ${attachments.length + 1}`,
                    url: url
                  })
                }
              }
            })
            
            return {
              id: idx + 1,
              role,
              text: textParts.join('\n') || undefined,
              attachments: attachments.length > 0 ? attachments : undefined
            }
          } else {
            // Handle simple string content
            return { id: idx + 1, role, text: String(content) }
          }
        })
        
        // Filter out null messages and set the filtered messages
        const filteredMsgs = uiMsgs.filter(msg => msg !== null) as UiMessage[]
        console.log('✅ Setting messages:', filteredMsgs.length, 'filtered messages')
        console.log('📋 Messages content:', filteredMsgs.map(m => ({ role: m.role, text: m.text?.substring(0, 50) + '...' })))
        setMessages(filteredMsgs)
      } else {
        // If no history, reset to default message
        console.log('⚠️ No history found, resetting to default message')
        setMessages([{ id: 1, role: 'assistant', text: 'Hi! I can help modify this site.' }])
      }
      
      // Call the callback after history is loaded
      if (onHistoryLoaded) {
        console.log('🔄 Calling onHistoryLoaded callback')
        onHistoryLoaded()
      }
    } catch (error) {
      console.error('❌ Failed to load chat history:', error)
      // Still call the callback even if there's an error
      if (onHistoryLoaded) {
        onHistoryLoaded()
      }
    }
  }, [siteId, onHistoryLoaded])
  
  const clearHistory = async () => {
    if (!siteId) return
    
    try {
      const url = `/api/${siteId}/chat/history`
      await fetch(url, { method: 'DELETE' })
      setMessages([])
    } catch (error) {
      console.error('Failed to clear chat history:', error)
    }
  }
  
  return {
    messages,
    setMessages,
    loadHistory,
    clearHistory
  }
}

function useFileAttachments() {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  
  const onFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || !fileList.length) return
    
    const files = Array.from(fileList)
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const isImage = file.type.startsWith('image/')
      const isText = file.type.startsWith('text/') || /\.(txt|md|markdown|json|csv|xml|html|css|js|ts)$/i.test(file.name)
      
      if (isImage) {
        const reader = new FileReader()
        
        reader.onload = async () => {
          try {
            const dataUrl = String(reader.result || '')
            // Extract base64 data from data URL
            const base64Data = dataUrl.split(',')[1]
            
            // Add temporary attachment with loading state
            setAttachments(curr => [...curr, { 
              kind: 'image', 
              name: file.name, 
              url: 'uploading...' 
            }])
            
            // Upload to ImgBB
            const uploadedUrl = await uploadImageToStorage(base64Data)
            
            // Update attachment with actual URL
            setAttachments(curr => curr.map(att => 
              att.kind === 'image' && att.url === 'uploading...' && att.name === file.name
                ? { ...att, url: uploadedUrl }
                : att
            ))
          } catch (error) {
            console.error('Failed to upload image:', error)
            // Remove failed upload
            setAttachments(curr => curr.filter(att => 
              !(att.kind === 'image' && att.url === 'uploading...' && att.name === file.name)
            ))
          }
        }
        
        reader.readAsDataURL(file)
      } else if (isText) {
        const reader = new FileReader()
        reader.onload = () => {
          const content = String(reader.result || '')
          setAttachments(curr => [...curr, { kind: 'text', name: file.name, content }])
        }
        reader.readAsText(file)
      }
    }
  }
  
  const removeAttachment = (index: number) => {
    setAttachments(curr => curr.filter((_, i) => i !== index))
  }
  
  const clearAttachments = () => {
    setAttachments([])
  }
  
  return {
    attachments,
    onFilesSelected,
    removeAttachment,
    clearAttachments
  }
}

// ===== MAIN COMPONENT =====

function ChatOverlay({ siteId }: ChatOverlayProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isPushingToGitHub, setIsPushingToGitHub] = useState(false)
  const [showPublishConfirm, setShowPublishConfirm] = useState(false)
  const [isUndoing, setIsUndoing] = useState(false)
  const [isRedoing, setIsRedoing] = useState(false)
  const [isStartingOver, setIsStartingOver] = useState(false)
  
  const { launcherPos, setLauncherPos, panelPos, setPanelPos, initializeLauncherPosition, updatePositionsOnResize } = usePositioning()
  const { isDragging, setIsDragging, isPanelDragging, setIsPanelDragging, dragOffsetRef, panelDragOffsetRef, didDragRef } = useDragging()
  
  // First declare the callbacks
  const handleHistoryLoaded = useCallback(() => {
    // After history is loaded, check site status
    console.log('History loaded, checking site status...')
    // We'll call checkSiteStatus after the hooks are initialized
  }, [])

  const { messages, setMessages, loadHistory, clearHistory } = useChatHistory(siteId, handleHistoryLoaded)
  
  const handleStatusReady = useCallback(() => {
    // When site becomes ready, reload history
    console.log('🔄 Site became ready, reloading history...')
    loadHistory()
  }, [loadHistory])

  const { siteStatus, isPolling, checkSiteStatus, startPolling } = useSiteStatus(siteId, handleStatusReady)
  const { attachments, onFilesSelected, removeAttachment, clearAttachments } = useFileAttachments()
  
  const panelRef = useRef<HTMLDivElement | null>(null)
  
  const hasPending = useMemo(() => !!(input.trim() || attachments.length), [input, attachments.length])

  // Inject CSS keyframes for typing animation
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = typingKeyframes
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  // Load persisted history on mount
  useEffect(() => {
    initializeLauncherPosition()
    loadHistory()
  }, [siteId])

  // Check site status after history is loaded
  useEffect(() => {
    if (messages.length > 0) {
      console.log('History loaded, checking site status...')
      checkSiteStatus()
    }
  }, [messages.length, checkSiteStatus])

  // Handle site status changes
  useEffect(() => {
    console.log('🔄 Site status changed:', siteStatus, 'isPolling:', isPolling)
    if (siteStatus === 'UNDER_DEV' && !isPolling) {
      console.log('🚧 Site is under development, starting polling...')
      startPolling()
    }
    // Note: History reload is now handled directly in the polling mechanism
    // when status changes to READY, so we don't need to handle it here
  }, [siteStatus, isPolling, startPolling])

  // Keep launcher within bounds on resize
  useEffect(() => {
    window.addEventListener('resize', updatePositionsOnResize)
    return () => window.removeEventListener('resize', updatePositionsOnResize)
  }, [])

  // ===== DRAG HANDLERS =====

  const onLauncherPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!launcherPos) return
    
    try { (e.target as HTMLElement).setPointerCapture?.(e.pointerId) } catch {}
    setIsDragging(true)
    didDragRef.current = false
    dragOffsetRef.current = { dx: e.clientX - launcherPos.x, dy: e.clientY - launcherPos.y }

    const onMove = (ev: PointerEvent) => {
      const { dx, dy } = dragOffsetRef.current
      let nx = ev.clientX - dx
      let ny = ev.clientY - dy
      const w = window.innerWidth
      const h = window.innerHeight
      
      // Clamp within viewport
      nx = clampPosition(nx, 0, w - BUTTON_SIZE)
      ny = clampPosition(ny, 0, h - BUTTON_SIZE)
      
      // Detect actual movement to suppress click-open
      if (Math.abs(nx - launcherPos.x) > 2 || Math.abs(ny - launcherPos.y) > 2) {
        didDragRef.current = true
      }
      setLauncherPos({ x: nx, y: ny })
    }
    
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setIsDragging(false)
      
      // If user did not drag, treat as open tap
      if (!didDragRef.current) {
        // Initialize panel near the button if not yet positioned
        try {
          const w = window.innerWidth
          const h = window.innerHeight
          const lx = launcherPos?.x ?? DEFAULT_MARGIN
          const ly = launcherPos?.y ?? Math.max(0, h - DEFAULT_MARGIN - BUTTON_SIZE)
          const panelPos = calculatePanelPosition({ x: lx, y: ly }, w, h)
          setPanelPos(panelPos)
        } catch {}
        setOpen(true)
      }
    }
    
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const onHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!open) return
    
    // Ignore drags starting from interactive controls inside header
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, textarea, select')) {
      return
    }
    
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId) } catch {}
    const rect = panelRef.current?.getBoundingClientRect()
    const panelLeft = panelPos?.x ?? rect?.left ?? 0
    const panelTop = panelPos?.y ?? rect?.top ?? 0
    setIsPanelDragging(true)
    panelDragOffsetRef.current = { dx: e.clientX - panelLeft, dy: e.clientY - panelTop }

    const onMove = (ev: PointerEvent) => {
      const w = window.innerWidth
      const h = window.innerHeight
      const r = panelRef.current?.getBoundingClientRect()
      const pw = r?.width ?? PANEL_WIDTH
      const ph = r?.height ?? Math.min(Math.floor(PANEL_HEIGHT_RATIO * h), MAX_PANEL_HEIGHT)
      
      let nx = ev.clientX - panelDragOffsetRef.current.dx
      let ny = ev.clientY - panelDragOffsetRef.current.dy
      nx = clampPosition(nx, DEFAULT_MARGIN, w - pw - DEFAULT_MARGIN)
      ny = clampPosition(ny, DEFAULT_MARGIN, h - ph - DEFAULT_MARGIN)
      setPanelPos({ x: nx, y: ny })

      // Keep launcher button aligned to the panel's bottom-right while dragging
      let bx = nx + pw - BUTTON_SIZE
      let by = ny + ph - BUTTON_SIZE
      bx = clampPosition(bx, 0, w - BUTTON_SIZE)
      by = clampPosition(by, 0, h - BUTTON_SIZE)
      setLauncherPos({ x: bx, y: by })
    }
    
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setIsPanelDragging(false)
    }
    
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // ===== PUBLISH HANDLERS =====

  const handlePublishClick = () => {
    setShowPublishConfirm(true)
  }

  const handlePublishConfirm = async () => {
    setShowPublishConfirm(false)
    
    if (!siteId) {
      console.error('No siteId provided for publish')
      return
    }

    setIsPushingToGitHub(true)
    
    try {
      const response = await fetch(`/api/${siteId}/github/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Add success message to chat
        const successMessage: UiMessage = {
          id: Date.now(),
          role: 'assistant',
          text: `✅ Successfully published your site changes! Your website has been updated on GitHub.`
        }
        setMessages(curr => [...curr, successMessage])
      } else {
        // Add error message to chat
        const errorMessage: UiMessage = {
          id: Date.now(),
          role: 'assistant',
          text: `❌ ${data.message || data.error || 'Unable to publish changes. Please try again.'}`
        }
        setMessages(curr => [...curr, errorMessage])
      }
    } catch (error) {
      console.error('Publish error:', error)
      const errorMessage: UiMessage = {
        id: Date.now(),
        role: 'assistant',
        text: `❌ Failed to publish changes: ${error instanceof Error ? error.message : 'Network error'}`
      }
      setMessages(curr => [...curr, errorMessage])
    } finally {
      setIsPushingToGitHub(false)
    }
  }

  const handlePublishCancel = () => {
    setShowPublishConfirm(false)
  }

  const handleUndo = async () => {
    if (!siteId) {
      console.error('No siteId provided for undo')
      return
    }

    setIsUndoing(true)
    
    try {
      const response = await fetch(`/api/${siteId}/undo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Add success message to chat
        const successMessage: UiMessage = {
          id: Date.now(),
          role: 'assistant',
          text: `${data.message || '✅ Successfully undone your last changes!'}`
        }
        setMessages(curr => [...curr, successMessage])
        
        // Trigger iframe reload to show the undone changes
        try {
          window.dispatchEvent(new CustomEvent('site-files-applied', { detail: { siteId } }))
        } catch (error) {
          console.error('Failed to trigger iframe reload:', error)
        }
      } else {
        // Add error message to chat
        const errorMessage: UiMessage = {
          id: Date.now(),
          role: 'assistant',
          text: `❌ ${data.message || data.error || 'Unable to undo changes. Please try again.'}`
        }
        setMessages(curr => [...curr, errorMessage])
      }
    } catch (error) {
      console.error('Undo error:', error)
      const errorMessage: UiMessage = {
        id: Date.now(),
        role: 'assistant',
        text: `❌ Failed to undo changes: ${error instanceof Error ? error.message : 'Network error'}`
      }
      setMessages(curr => [...curr, errorMessage])
    } finally {
      setIsUndoing(false)
    }
  }

  const handleRedo = async () => {
    if (!siteId) {
      console.error('No siteId provided for redo')
      return
    }

    setIsRedoing(true)
    
    try {
      const response = await fetch(`/api/${siteId}/redo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Add success message to chat
        const successMessage: UiMessage = {
          id: Date.now(),
          role: 'assistant',
          text: `${data.message || '✅ Successfully restored your last changes!'}`
        }
        setMessages(curr => [...curr, successMessage])
        
        // Trigger iframe reload to show the redone changes
        try {
          window.dispatchEvent(new CustomEvent('site-files-applied', { detail: { siteId } }))
        } catch (error) {
          console.error('Failed to trigger iframe reload:', error)
        }
      } else {
        // Add error message to chat
        const errorMessage: UiMessage = {
          id: Date.now(),
          role: 'assistant',
          text: `❌ ${data.message || data.error || 'Unable to restore changes. Please try again.'}`
        }
        setMessages(curr => [...curr, errorMessage])
      }
    } catch (error) {
      console.error('Redo error:', error)
      const errorMessage: UiMessage = {
        id: Date.now(),
        role: 'assistant',
        text: `❌ Failed to redo changes: ${error instanceof Error ? error.message : 'Network error'}`
      }
      setMessages(curr => [...curr, errorMessage])
    } finally {
      setIsRedoing(false)
    }
  }

  const handleStartOver = async () => {
    if (!siteId) {
      console.error('No siteId provided for start over')
      return
    }

    setIsStartingOver(true)
    
    try {
      const response = await fetch(`/api/${siteId}/start-over`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Add success message to chat
        const successMessage: UiMessage = {
          id: Date.now(),
          role: 'assistant',
          text: `${data.message || '✅ Successfully started over! Your website has been refreshed with the latest version. All your recent changes have been cleared.'}`
        }
        setMessages(curr => [...curr, successMessage])
        
        // Trigger iframe reload to show the updated changes
        try {
          window.dispatchEvent(new CustomEvent('site-files-applied', { detail: { siteId } }))
        } catch (error) {
          console.error('Failed to trigger iframe reload:', error)
        }
      } else {
        // Add error message to chat
        const errorMessage: UiMessage = {
          id: Date.now(),
          role: 'assistant',
          text: `❌ ${data.message || data.error || 'Unable to start over. Please try again.'}`
        }
        setMessages(curr => [...curr, errorMessage])
      }
    } catch (error) {
      console.error('Start over error:', error)
      const errorMessage: UiMessage = {
        id: Date.now(),
        role: 'assistant',
        text: `❌ Failed to start over: ${error instanceof Error ? error.message : 'Network error'}`
      }
      setMessages(curr => [...curr, errorMessage])
    } finally {
      setIsStartingOver(false)
    }
  }

  // ===== CHAT HANDLERS =====

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasPending) return
    setIsLoading(true)

    const userMessage: UiMessage = { 
      id: Date.now(), 
      role: 'user', 
      text: input.trim() || undefined, 
      attachments: attachments.length ? attachments : undefined 
    }
    const displayMessages = [...messages, userMessage]
    setMessages(displayMessages)

    const apiMessages: any[] = []

    // Append the user's message and attachments
    const userParts = buildApiMessages([userMessage])
    apiMessages.push(...userParts)

    const payload = { messages: apiMessages }
    const url = `/api/${siteId}/chat`
    
    // Create AI message placeholder
    const aiMessageId = Date.now() + 1
    const aiMessage: UiMessage = { id: aiMessageId, role: 'assistant', text: 'Thinking...' }
    setMessages(curr => [...curr, aiMessage])

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.error) {
        // Handle error
        setMessages(curr => curr.map(m => 
          m.id === aiMessageId 
            ? { ...m, text: data.message?.content || 'Error contacting the AI service.' }
            : m
        ))
      } else if (data.message) {
        // Update message with AI response
        const aiResponse = data.message.content || ''
        setMessages(curr => curr.map(m => 
          m.id === aiMessageId 
            ? { ...m, text: aiResponse }
            : m
        ))
        
        // Check if we need to reload the iframe (Aider made changes)
        if (data.reloadIframe) {
          console.log('[Chat] Aider made changes, triggering iframe reload')
          try {
            // Notify container to reload iframe
            window.dispatchEvent(new CustomEvent('site-files-applied', { detail: { siteId } }))
          } catch (error) {
            console.error('[Chat] Failed to trigger iframe reload:', error)
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(curr => curr.map(m => 
        m.id === aiMessageId 
          ? { ...m, text: 'Error contacting the AI service.' }
          : m
      ))
    } finally {
      setIsLoading(false)
    }
    
    setInput('')
    clearAttachments()
  }

  // ===== RENDER HELPERS =====

  const renderMessage = (m: UiMessage) => {
    const isUser = m.role === 'user'
    return (
      <div key={m.id} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
        <div
          style={{
            maxWidth: '80%',
            padding: '10px 12px',
            borderRadius: 14,
            background: isUser ? '#2563eb' : 'transparent',
            color: isUser ? '#ffffff' : '#111827',
            boxShadow: '0 1px 1px rgba(0,0,0,0.04)'
          }}
        >
          {m.text && (
            <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
          )}
          {Array.isArray(m.attachments) && m.attachments.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {m.attachments.map((att, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {att.kind === 'editedFile' ? (
                    <a href={att.url} download={att.name} style={{ color: isUser ? '#bfdbfe' : '#2563eb', textDecoration: 'underline' }}>
                      Download {att.name}
                    </a>
                  ) : att.kind === 'image' ? (
                    <img src={att.url} alt={att.name} style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 10, border: '1px solid #e5e7eb' }} />
                  ) : (
                    <span style={{ fontSize: 12, color: isUser ? '#dbeafe' : '#374151' }}>{att.name}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderLoadingIndicator = () => {
    const isSiteUnderDev = siteStatus === 'UNDER_DEV' && !isLoading
    const text = isSiteUnderDev ? 'Processing your request...' : 'Thinking...'
    
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start' }} aria-busy={true}>
        <div style={{
          padding: '10px 12px',
          borderRadius: 14,
          background: 'transparent',
          color: '#6b7280',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8
        }}>
          <svg width="18" height="18" viewBox="0 0 50 50" fill="none" aria-hidden="true">
            <circle cx="25" cy="25" r="20" stroke="#9ca3af" strokeWidth="4" strokeLinecap="round" strokeDasharray="31.4 31.4">
              <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" />
            </circle>
          </svg>
          <span>{text}</span>
        </div>
      </div>
    )
  }


  const renderAttachment = (att: Attachment, idx: number) => {
    const isUploading = att.kind === 'image' && att.url === 'uploading...'
    
    return (
      <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: 8, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}>
        {att.kind === 'image' ? (
          isUploading ? (
            <div style={{ 
              width: 40, 
              height: 40, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              background: '#f3f4f6',
              borderRadius: 8,
              color: '#6b7280'
            }}>
              <svg width="16" height="16" viewBox="0 0 50 50" fill="currentColor" aria-hidden="true">
                <circle cx="25" cy="25" r="20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="31.4 31.4">
                  <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" />
                </circle>
              </svg>
            </div>
          ) : (
            <img src={att.url} alt={att.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8 }} />
          )
        ) : (
          <span style={{ fontSize: 12, color: '#374151' }}>{att.name}</span>
        )}
        <button
          onClick={() => removeAttachment(idx)}
          disabled={isUploading}
          aria-label="Remove attachment"
          title="Remove attachment"
          style={{ 
            background: 'transparent', 
            border: 'none', 
            color: isUploading ? '#d1d5db' : '#6b7280', 
            cursor: isUploading ? 'not-allowed' : 'pointer' 
          }}
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
      {/* Toggle Button */}
      {!open && (
        <button
          onPointerDown={onLauncherPointerDown}
          aria-label="Open chat"
          title="Open chat"
          style={{
            position: 'fixed',
            left: launcherPos ? launcherPos.x : 20,
            top: launcherPos ? launcherPos.y : undefined,
            right: undefined,
            bottom: launcherPos ? undefined : 20,
            zIndex: 50,
            pointerEvents: 'auto',
            borderRadius: 9999,
            width: BUTTON_SIZE,
            height: BUTTON_SIZE,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#111827',
            color: '#fff',
            border: '1px solid #1f2937',
            boxShadow: '0 10px 20px rgba(0,0,0,0.25)',
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
          className={`chat-launcher${isDragging ? ' dragging' : ''}`}
        >
          <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: 0.5, color: '#ffffff' }}>AI</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            left: panelPos?.x ?? undefined,
            top: panelPos?.y ?? undefined,
            right: panelPos ? undefined : 20,
            bottom: panelPos ? undefined : 20,
            width: PANEL_WIDTH,
            maxWidth: 'calc(100% - 40px)',
            maxHeight: '70vh',
            display: 'flex',
            flexDirection: 'column',
            background: '#ffffff',
            color: '#111',
            border: '1px solid #e5e7eb',
            borderRadius: 16,
            overflow: 'hidden',
            zIndex: 40,
            pointerEvents: 'auto',
            boxShadow: '0 20px 40px rgba(2,6,23,0.2)'
          }}
        >
          {/* Header */}
          <div
            onPointerDown={onHeaderPointerDown}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid #e5e7eb', background: '#f8fafc', cursor: isPanelDragging ? 'grabbing' : 'grab', userSelect: 'none' }}
          >
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 9999,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#111827',
              color: '#fff',
              fontWeight: 800,
              fontSize: 12,
              letterSpacing: 0.5
            }}>AI</div>
            <strong style={{ fontSize: 14 }}>AI Assistant</strong>
            <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={handleStartOver}
                disabled={isStartingOver}
                aria-label="Start over - pull latest from GitHub"
                title="Start over - pull latest from GitHub"
                style={{
                  background: isStartingOver ? '#93c5fd' : 'transparent',
                  border: 'none',
                  color: isStartingOver ? '#ffffff' : '#8b5cf6',
                  cursor: isStartingOver ? 'not-allowed' : 'pointer',
                  padding: 6,
                  borderRadius: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                {isStartingOver ? (
                  <svg width="16" height="16" viewBox="0 0 50 50" fill="currentColor" aria-hidden="true">
                    <circle cx="25" cy="25" r="20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="31.4 31.4">
                      <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" />
                    </circle>
                  </svg>
                           ) : (
             <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
               <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
             </svg>
           )}
                {isStartingOver && <span style={{ fontSize: 12 }}>Starting over...</span>}
              </button>
              <button
                onClick={handleUndo}
                disabled={isUndoing}
                aria-label="Undo last changes"
                title="Undo last changes"
                style={{
                  background: isUndoing ? '#93c5fd' : 'transparent',
                  border: 'none',
                  color: isUndoing ? '#ffffff' : '#ef4444',
                  cursor: isUndoing ? 'not-allowed' : 'pointer',
                  padding: 6,
                  borderRadius: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                {isUndoing ? (
                  <svg width="16" height="16" viewBox="0 0 50 50" fill="currentColor" aria-hidden="true">
                    <circle cx="25" cy="25" r="20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="31.4 31.4">
                      <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" />
                    </circle>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
                  </svg>
                )}
                {isUndoing && <span style={{ fontSize: 12 }}>Undoing...</span>}
              </button>
              <button
                onClick={handleRedo}
                disabled={isRedoing}
                aria-label="Redo last changes"
                title="Redo last changes"
                style={{
                  background: isRedoing ? '#93c5fd' : 'transparent',
                  border: 'none',
                  color: isRedoing ? '#ffffff' : '#3b82f6',
                  cursor: isRedoing ? 'not-allowed' : 'pointer',
                  padding: 6,
                  borderRadius: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                {isRedoing ? (
                  <svg width="16" height="16" viewBox="0 0 50 50" fill="currentColor" aria-hidden="true">
                    <circle cx="25" cy="25" r="20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="31.4 31.4">
                      <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" />
                    </circle>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/>
                  </svg>
                )}
                {isRedoing && <span style={{ fontSize: 12 }}>Redoing...</span>}
              </button>
              <button
                onClick={handlePublishClick}
                disabled={isPushingToGitHub}
                aria-label="Publish changes"
                title="Publish site changes"
                style={{
                  background: isPushingToGitHub ? '#93c5fd' : 'transparent',
                  border: 'none',
                  color: isPushingToGitHub ? '#ffffff' : '#10b981',
                  cursor: isPushingToGitHub ? 'not-allowed' : 'pointer',
                  padding: 6,
                  borderRadius: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                {isPushingToGitHub ? (
                  <svg width="16" height="16" viewBox="0 0 50 50" fill="currentColor" aria-hidden="true">
                    <circle cx="25" cy="25" r="20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="31.4 31.4">
                      <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" />
                    </circle>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                )}
                {isPushingToGitHub && <span style={{ fontSize: 12 }}>Publishing...</span>}
              </button>
              <button
                onClick={clearHistory}
                aria-label="Clear history"
                title="Clear history"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#6b7280',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 6
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M9 3a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1h5v2H4V4h5V3zm2 0h2v1h-2V3zM6 8h12v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8zm3 2v9h2v-9H9zm4 0v9h2v-9h-2z" />
                </svg>
              </button>
              <button
                onClick={() => {
                  console.log('Manual reload triggered')
                  loadHistory()
                }}
                aria-label="Reload history"
                title="Reload history"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#6b7280',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 6
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                </svg>
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Minimize chat"
                title="Minimize chat"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#6b7280',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 6
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M5 12h14v2H5z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflow: 'auto', padding: 12, background: '#ffffff' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {messages.map(renderMessage)}
              {/* Show thinking indicator when site is under development or when loading */}
              {(isLoading && !messages.some(m => m.role === 'assistant' && m.text === 'Thinking...')) || 
               (siteStatus === 'UNDER_DEV' && !isLoading) ? renderLoadingIndicator() : null}
            </div>
          </div>

          {/* Composer */}
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderTop: '1px solid #e5e7eb', background: '#f8fafc' }}
          >
            <label
              title="Attach files"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, border: '1px solid #e2e8f0', borderRadius: 10, background: '#ffffff', cursor: 'pointer' }}
            >
              <input
                type="file"
                multiple
                accept="image/*,.txt,.md,.markdown,.json,.csv,.xml,.html,.css,.js,.ts"
                onChange={e => onFilesSelected(e.target.files)}
                style={{ display: 'none' }}
              />
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M19.35 10.04A7.49 7.49 0 0 0 5.26 8.37 5.5 5.5 0 0 0 6 19h12a4 4 0 0 0 1.35-8.96zM11 17H9v-4H6l5-5 5 5h-3v4h-2z"/>
              </svg>
            </label>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={attachments.length ? 'Describe the files or ask a question...' : 'Ask to change something...'}
              style={{ 
                flex: 1, 
                padding: '10px 12px', 
                borderRadius: 12, 
                border: '1px solid #e2e8f0', 
                background: '#ffffff', 
                color: '#111', 
                outline: 'none',
                resize: 'none',
                minHeight: '40px',
                maxHeight: '120px',
                fontFamily: 'inherit',
                fontSize: '14px',
                lineHeight: '1.4',
                direction: 'auto' as any,
                textAlign: 'start',
                unicodeBidi: 'plaintext'
              }}
              rows={1}
              dir="auto"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (hasPending && !isLoading) {
                    handleSubmit(e)
                  }
                }
              }}
            />
            <button
              type="submit"
              disabled={!hasPending || isLoading}
              style={{
                width: 40,
                height: 40,
                borderRadius: 9999,
                background: (!hasPending || isLoading) ? '#93c5fd' : '#2563eb',
                color: '#fff',
                border: 'none',
                cursor: (!hasPending || isLoading) ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
              </svg>
            </button>
          </form>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div style={{ padding: '8px 12px', borderTop: '1px solid #e5e7eb', background: '#f8fafc', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {attachments.map(renderAttachment)}
            </div>
          )}
        </div>
      )}

      {/* Publish Confirmation Modal */}
      {showPublishConfirm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          pointerEvents: 'auto'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: 24,
            maxWidth: 400,
            width: '90%',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 16
            }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 9999,
                background: '#fef3c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#f59e0b" aria-hidden="true">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div>
                <h3 style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#111827'
                }}>Publish Changes</h3>
                <p style={{
                  margin: 0,
                  fontSize: 14,
                  color: '#6b7280'
                }}>Are you sure you want to publish your changes?</p>
              </div>
            </div>
            
            <p style={{
              margin: '0 0 20px 0',
              fontSize: 14,
              color: '#374151',
              lineHeight: 1.5
            }}>
              This will commit and push all your site changes to the repository. This action cannot be undone.
            </p>
            
            <div style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={handlePublishCancel}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid #d1d5db',
                  background: '#ffffff',
                  color: '#374151',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500
                }}
              >
                Cancel
              </button>
              <button
                onClick={handlePublishConfirm}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#2563eb',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500
                }}
              >
                Publish Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatOverlay


