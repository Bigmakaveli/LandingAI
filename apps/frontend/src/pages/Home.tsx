import { useEffect, useRef } from 'react'
import ChatOverlay from './ChatOverlay'

function getSiteIdFromPathname(pathname: string): string | undefined {
  // Expecting paths like / or /:siteId
  const parts = pathname.split('/').filter(Boolean)
  return parts[0]
}

function Home() {
  const siteId = getSiteIdFromPathname(window.location.pathname) || 'example'
  const srcBase = `/sites/${siteId}/`
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    function handleApplied() {
      const iframe = iframeRef.current
      if (!iframe) return
      try {
        const url = new URL(iframe.src, window.location.origin)
        url.searchParams.set('v', String(Date.now()))
        iframe.src = url.pathname + url.search
      } catch {
        // Fallback to simple reload with cache-buster
        iframe.src = srcBase + `?v=${Date.now()}`
      }
    }
    window.addEventListener('site-files-applied' as any, handleApplied)
    return () => window.removeEventListener('site-files-applied' as any, handleApplied)
  }, [srcBase])



  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <iframe
        ref={iframeRef}
        src={srcBase}
        title="Embedded Site"
        style={{ width: '100%', height: '100%', border: '0', display: 'block' }}
      />
      <ChatOverlay siteId={siteId} />
    </div>
  )
}

export default Home


