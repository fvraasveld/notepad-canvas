import { useRef, useEffect, useState } from 'react'
import Atrament from 'atrament'
import changeDpiDataUrl from 'changedpi'
import './App.css'

export default function App() {
  const canvasRef = useRef(null)
  const bgCanvasRef = useRef(null)
  const atramentRef = useRef(null)
  const containerRef = useRef(null)
  
  // Zoom/Pan state
  const [view, setView] = useState({ offsetX: 0, offsetY: 0, scale: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const [lastPanPoint, setLastPanPoint] = useState(null)
  
  // Tools & Settings
  const [color, setColor] = useState('#000000')
  const [size, setSize] = useState(2)
  const [tool, setTool] = useState('draw')
  const [penType, setPenType] = useState('pen')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [bgPattern, setBgPattern] = useState('none')
  const [bgHex, setBgHex] = useState('#ffffff')
  
  // History - FIXED to work properly
  const [history, setHistory] = useState([])
  const [historyStep, setHistoryStep] = useState(-1)
  
  // UI
  const [colors, setColors] = useState(['#000000', '#FFFFFF', '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#5856D6'])
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showBgPicker, setShowBgPicker] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showSaves, setShowSaves] = useState(false)
  const [tempColor, setTempColor] = useState('#000000')
  
  // Save slots
  const [saves, setSaves] = useState(() => {
    const s = localStorage.getItem('canvas-saves-v15')
    return s ? JSON.parse(s) : []
  })
  
  const penTypes = {
    pen: { label: 'Pen', smoothing: 0.85, adaptive: true, weight: 1, opacity: 1 },
    pencil: { label: 'Pencil', smoothing: 0.5, adaptive: true, weight: 1.5, opacity: 0.8 },
    marker: { label: 'Marker', smoothing: 0.9, adaptive: false, weight: 2, opacity: 0.5 },
    brush: { label: 'Brush', smoothing: 0.95, adaptive: true, weight: 2, opacity: 0.9 },
    highlighter: { label: 'Highlighter', smoothing: 0.7, adaptive: false, weight: 8, opacity: 0.25 }
  }
  
  const bgPatterns = {
    none: 'None',
    grid: 'Grid',
    dots: 'Dots',
    lines: 'Lines',
    triangles: 'Triangles',
    hexagons: 'Hexagons',
    diagonal: 'Diagonal'
  }
  
  // Background drawing - MUST be defined before useEffect
  const drawBg = () => {
    const bg = bgCanvasRef.current
    if (!bg) return
    
    const ctx = bg.getContext('2d')
    const w = bg.width / (window.devicePixelRatio || 1)
    const h = bg.height / (window.devicePixelRatio || 1)
    
    ctx.clearRect(0, 0, w, h)
    
    if (bgColor !== 'transparent') {
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, w, h)
    }
    
    const patternColor = bgColor === '#ffffff' ? '#e0e0e0' : (bgColor === 'transparent' ? '#e0e0e0' : '#999')
    ctx.strokeStyle = patternColor
    ctx.fillStyle = patternColor
    ctx.lineWidth = 1
    
    const spacing = 30
    
    const drawHexagon = (ctx, x, y, size) => {
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i
        const hx = x + size * Math.cos(angle)
        const hy = y + size * Math.sin(angle)
        if (i === 0) ctx.moveTo(hx, hy)
        else ctx.lineTo(hx, hy)
      }
      ctx.closePath()
      ctx.stroke()
    }
    
    switch(bgPattern) {
      case 'grid':
        for (let x = 0; x < w; x += spacing) {
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, h)
          ctx.stroke()
        }
        for (let y = 0; y < h; y += spacing) {
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(w, y)
          ctx.stroke()
        }
        break
        
      case 'dots':
        for (let x = spacing/2; x < w; x += spacing) {
          for (let y = spacing/2; y < h; y += spacing) {
            ctx.beginPath()
            ctx.arc(x, y, 2, 0, Math.PI * 2)
            ctx.fill()
          }
        }
        break
        
      case 'lines':
        for (let y = 0; y < h; y += spacing) {
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(w, y)
          ctx.stroke()
        }
        break
        
      case 'triangles':
        const triSize = spacing
        for (let y = 0; y < h; y += triSize) {
          for (let x = 0; x < w; x += triSize * 2) {
            ctx.beginPath()
            ctx.moveTo(x, y)
            ctx.lineTo(x + triSize, y + triSize)
            ctx.lineTo(x - triSize, y + triSize)
            ctx.closePath()
            ctx.stroke()
          }
        }
        break
        
      case 'hexagons':
        const hexSize = 15
        const hexHeight = hexSize * Math.sqrt(3)
        for (let y = 0; y < h; y += hexHeight) {
          for (let x = 0; x < w; x += hexSize * 1.5) {
            const offsetX = (y / hexHeight) % 2 === 0 ? 0 : hexSize * 0.75
            drawHexagon(ctx, x + offsetX, y, hexSize)
          }
        }
        break
        
      case 'diagonal':
        for (let i = -h; i < w; i += spacing) {
          ctx.beginPath()
          ctx.moveTo(i, 0)
          ctx.lineTo(i + h, h)
          ctx.stroke()
        }
        break
    }
  }
  
  // Initialize
  useEffect(() => {
    const canvas = canvasRef.current
    const bgCanvas = bgCanvasRef.current
    if (!canvas || !bgCanvas) return
    
    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
    
    bgCanvas.width = rect.width * dpr
    bgCanvas.height = rect.height * dpr
    bgCanvas.style.width = `${rect.width}px`
    bgCanvas.style.height = `${rect.height}px`
    
    const ctx = canvas.getContext('2d', { desynchronized: true })
    ctx.scale(dpr, dpr)
    
    const bgCtx = bgCanvas.getContext('2d')
    bgCtx.scale(dpr, dpr)
    
    const atrament = new Atrament(canvas, {
      width: rect.width,
      height: rect.height,
      color,
      weight: size,
      smoothing: 0.85,
      adaptiveStroke: true
    })
    
    atrament.recordStrokes = false
    atramentRef.current = atrament
    
    drawBg()
    
    // Save initial blank state
    setTimeout(() => {
      const initialState = canvas.toDataURL('image/png')
      setHistory([initialState])
      setHistoryStep(0)
    }, 100)
    
    const handleTouch = (e) => {
      if (e.target === canvas) e.preventDefault()
    }
    document.addEventListener('touchmove', handleTouch, { passive: false })
    
    // Save to history after each stroke
    atrament.addEventListener('strokeend', () => {
      setTimeout(() => {
        const newState = canvas.toDataURL('image/png')
        setHistory(prev => {
          const newHistory = prev.slice(0, historyStep + 1)
          newHistory.push(newState)
          return newHistory.slice(-50) // Keep last 50 states
        })
        setHistoryStep(prev => Math.min(prev + 1, 49))
      }, 50)
    })
    
    return () => {
      document.removeEventListener('touchmove', handleTouch)
      if (atrament) atrament.destroy()
    }
  }, [])
  
  // Update Atrament
  useEffect(() => {
    const a = atramentRef.current
    if (!a) return
    
    const cfg = penTypes[penType]
    a.color = color
    a.weight = size * cfg.weight
    a.smoothing = cfg.smoothing
    a.adaptiveStroke = cfg.adaptive
    a.opacity = cfg.opacity
    
    // Set composite operation for highlighter transparency
    if (penType === 'highlighter' || penType === 'marker') {
      a.context.globalCompositeOperation = 'multiply'
    } else {
      a.context.globalCompositeOperation = 'source-over'
    }
    
    if (tool === 'eraser') {
      a.mode = 'erase'
    } else if (tool === 'fill') {
      a.mode = 'fill'
    } else {
      a.mode = 'draw'
    }
  }, [color, size, tool, penType])
  
  useEffect(() => {
    drawBg()
  }, [bgColor, bgPattern])
  
  // Zoom/Pan
  const handleWheel = (e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    const worldX = (mouseX - view.offsetX) / view.scale
    const worldY = (mouseY - view.offsetY) / view.scale
    
    const delta = -e.deltaY * 0.001
    const newScale = Math.max(0.1, Math.min(10, view.scale * Math.exp(delta)))
    
    setView({
      offsetX: mouseX - worldX * newScale,
      offsetY: mouseY - worldY * newScale,
      scale: newScale
    })
  }
  
  const handlePanStart = (e) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true)
      setLastPanPoint({ x: e.clientX, y: e.clientY })
    }
  }
  
  const handlePanMove = (e) => {
    if (isPanning && lastPanPoint) {
      const dx = e.clientX - lastPanPoint.x
      const dy = e.clientY - lastPanPoint.y
      setView(v => ({
        ...v,
        offsetX: v.offsetX + dx,
        offsetY: v.offsetY + dy
      }))
      setLastPanPoint({ x: e.clientX, y: e.clientY })
    }
  }
  
  const handlePanEnd = () => {
    setIsPanning(false)
    setLastPanPoint(null)
  }
  
  
  // History - FIXED UNDO/REDO
  const undo = () => {
    if (historyStep <= 0) return
    
    const newStep = historyStep - 1
    setHistoryStep(newStep)
    
    const a = atramentRef.current
    if (!a || !history[newStep]) return
    
    const img = new Image()
    img.onload = () => {
      a.clear()
      const ctx = a.context
      const dpr = window.devicePixelRatio || 1
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.drawImage(img, 0, 0)
      ctx.restore()
    }
    img.src = history[newStep]
  }
  
  const redo = () => {
    if (historyStep >= history.length - 1) return
    
    const newStep = historyStep + 1
    setHistoryStep(newStep)
    
    const a = atramentRef.current
    if (!a || !history[newStep]) return
    
    const img = new Image()
    img.onload = () => {
      a.clear()
      const ctx = a.context
      const dpr = window.devicePixelRatio || 1
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.drawImage(img, 0, 0)
      ctx.restore()
    }
    img.src = history[newStep]
  }
  
  const clear = () => {
    if (confirm('Clear canvas?')) {
      atramentRef.current?.clear()
      setTimeout(() => {
        const canvas = canvasRef.current
        if (canvas) {
          const newState = canvas.toDataURL('image/png')
          setHistory(prev => {
            const newHistory = prev.slice(0, historyStep + 1)
            newHistory.push(newState)
            return newHistory
          })
          setHistoryStep(prev => prev + 1)
        }
      }, 50)
    }
  }
  
  const resetBackground = () => {
    setBgColor('#ffffff')
    setBgPattern('none')
    setBgHex('#ffffff')
  }
  
  // Export with TRUE 300 DPI!
  // Export with TRUE 300 DPI!
  const exportImg = (fmt) => {
    const c = canvasRef.current
    const bg = bgCanvasRef.current
    
    const dpr = window.devicePixelRatio || 1
    const merge = document.createElement('canvas')
    merge.width = c.width
    merge.height = c.height
    
    const ctx = merge.getContext('2d')
    if (bgColor !== 'transparent' || bgPattern !== 'none') {
      ctx.drawImage(bg, 0, 0)
    }
    ctx.drawImage(c, 0, 0)
    
    let url = merge.toDataURL(fmt === 'jpeg' ? 'image/jpeg' : 'image/png', 1.0)
    
    // TRUE 300 DPI!
    url = changeDpiDataUrl(url, 300)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `canvas-300dpi-${Date.now()}.${fmt === 'jpeg' ? 'jpg' : 'png'}`
    a.click()
    setShowExport(false)
  }
  
  // Save/Load - FIXED
  const save = () => {
    const name = prompt('Save name:')
    if (!name) return
    
    const c = canvasRef.current
    const bg = bgCanvasRef.current
    const dpr = window.devicePixelRatio || 1
    
    const m = document.createElement('canvas')
    m.width = c.width
    m.height = c.height
    const ctx = m.getContext('2d')
    
    // Merge background and drawing
    if (bgColor !== 'transparent' || bgPattern !== 'none') {
      ctx.drawImage(bg, 0, 0)
    }
    ctx.drawImage(c, 0, 0)
    
    const newSave = {
      id: Date.now(),
      name,
      data: m.toDataURL('image/png', 1),
      date: new Date().toLocaleString(),
      bgColor,
      bgPattern
    }
    
    const newSaves = [...saves, newSave]
    setSaves(newSaves)
    localStorage.setItem('canvas-saves-v15', JSON.stringify(newSaves))
    alert('Saved!')
  }
  
  const load = (s) => {
    const a = atramentRef.current
    if (!a) return
    
    const img = new Image()
    img.onload = () => {
      a.clear()
      const ctx = a.context
      const dpr = window.devicePixelRatio || 1
      
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.drawImage(img, 0, 0, a.canvas.width, a.canvas.height)
      ctx.restore()
      
      // Restore background settings if saved
      if (s.bgColor) setBgColor(s.bgColor)
      if (s.bgPattern) setBgPattern(s.bgPattern)
      
      // Add to history
      setTimeout(() => {
        const newState = a.canvas.toDataURL('image/png')
        setHistory([newState])
        setHistoryStep(0)
      }, 100)
    }
    img.src = s.data
    setShowSaves(false)
  }
  
  const deleteSave = (id) => {
    if (confirm('Delete this save?')) {
      const newSaves = saves.filter(s => s.id !== id)
      setSaves(newSaves)
      localStorage.setItem('canvas-saves-v15', JSON.stringify(newSaves))
    }
  }
  
  const updateBgHex = (hex) => {
    setBgHex(hex)
    if (/^#[0-9A-F]{6}$/i.test(hex)) {
      setBgColor(hex)
    }
  }

  return (
    <div className="app">
      <div className="toolbar">
        <div className="tools">
          <button className={`tool ${tool === 'draw' && penType === 'pen' ? 'active' : ''}`} onClick={() => { setTool('draw'); setPenType('pen'); }} title="Pen">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
            </svg>
          </button>
          
          <button className={`tool ${tool === 'draw' && penType === 'pencil' ? 'active' : ''}`} onClick={() => { setTool('draw'); setPenType('pencil'); }} title="Pencil">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
            </svg>
          </button>
          
          <button className={`tool ${tool === 'draw' && penType === 'marker' ? 'active' : ''}`} onClick={() => { setTool('draw'); setPenType('marker'); }} title="Marker">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m15 5 4 4"/><path d="M13 7 8.7 2.7a2.41 2.41 0 0 0-3.4 0L2.7 5.3a2.41 2.41 0 0 0 0 3.4L7 13"/><path d="m8 6 2-2"/><path d="m2 22 5.5-1.5L21.17 6.83a2.82 2.82 0 0 0-4-4L3.5 16.5Z"/>
            </svg>
          </button>
          
          <button className={`tool ${tool === 'draw' && penType === 'brush' ? 'active' : ''}`} onClick={() => { setTool('draw'); setPenType('brush'); }} title="Brush">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/>
            </svg>
          </button>
          
          <button className={`tool ${tool === 'draw' && penType === 'highlighter' ? 'active' : ''}`} onClick={() => { setTool('draw'); setPenType('highlighter'); }} title="Highlighter">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.5 1.15a1.93 1.93 0 0 0-1.15-.65c-.78-.1-1.5.25-2.12.87L7.35 9.25 1.9 14.7a.75.75 0 0 0 0 1.06l3.54 3.54.53.53 1.06 1.06a.75.75 0 0 0 1.06 0l5.45-5.45 7.88-7.88c.62-.62.97-1.34.87-2.12-.1-.78-.42-1.33-.79-1.79l-2.85-2.85z" opacity="0.5"/>
              <path d="M21.75 20c0 .41-.34.75-.75.75H9c-.41 0-.75-.34-.75-.75s.34-.75.75-.75h12c.41 0 .75.34.75.75z"/>
            </svg>
          </button>
          
          <div className="divider"></div>
          
          <button className={`tool ${tool === 'eraser' ? 'active' : ''}`} onClick={() => setTool('eraser')} title="Eraser" style={{ color: tool === 'eraser' ? '#fff' : '#FF3B30' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/>
            </svg>
          </button>
          
          <button className={`tool ${tool === 'fill' ? 'active' : ''}`} onClick={() => setTool('fill')} title="Fill">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 11h-8v-2h8m0-2H11V5l-2-2-2 2v2H3v14h8.09c-.05-.33-.09-.66-.09-1 0-2.76 2.24-5 5-5s5 2.24 5 5v1h2V9l-2-2m-6 9v-2c-1.68 0-3.06 1.34-3.1 3-.04 1.67 1.26 3 2.94 3h.16c.83 0 1.64-.33 2.24-.93.6-.6.93-1.41.93-2.24A3.16 3.16 0 0 0 13 18z"/>
            </svg>
          </button>
        </div>
        
        <div className="divider"></div>
        
        <div className="colors">
          {colors.map(c => (
            <button key={c} className={`color ${color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
          ))}
          <button className="color add" onClick={() => setShowColorPicker(true)}>+</button>
        </div>
        
        <div className="divider"></div>
        
        <div className="size-ctrl">
          <span>Size: {size}px</span>
          <input type="range" min="1" max="50" value={size} onChange={e => setSize(+e.target.value)} />
        </div>
        
        <div className="divider"></div>
        
        <div className="bg-ctrl">
          <button onClick={() => setShowBgPicker(!showBgPicker)} title="Background">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
            </svg>
          </button>
          <button onClick={resetBackground} title="Reset Background">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
            </svg>
          </button>
        </div>
        
        <div className="divider"></div>
        
        <div className="actions">
          <button onClick={undo} disabled={historyStep <= 0} title="Undo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-9 9"/>
            </svg>
          </button>
          <button onClick={redo} disabled={historyStep >= history.length - 1} title="Redo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 019 9"/>
            </svg>
          </button>
          <button onClick={clear}>Clear</button>
          <button onClick={save} className="primary">Save</button>
          <button onClick={() => setShowSaves(!showSaves)}>Load</button>
          <button onClick={() => setShowExport(!showExport)} className="primary">Export</button>
        </div>
      </div>
      
      {showColorPicker && (
        <div className="modal" onClick={() => setShowColorPicker(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Pick Color</h3>
            <input type="color" value={tempColor} onChange={e => setTempColor(e.target.value)} className="color-big" />
            <div className="color-preview" style={{ background: tempColor }}>{tempColor}</div>
            <div className="hex-input">
              <label>HEX:</label>
              <input type="text" value={tempColor} onChange={e => setTempColor(e.target.value)} placeholder="#000000" />
            </div>
            <div className="modal-btns">
              <button onClick={() => { setColors([...colors, tempColor]); setColor(tempColor); setShowColorPicker(false); }} className="primary">Add</button>
              <button onClick={() => setShowColorPicker(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      
      {showBgPicker && (
        <div className="modal" onClick={() => setShowBgPicker(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Background Settings</h3>
            
            <div className="bg-section">
              <label>Color</label>
              <input type="color" value={bgColor === 'transparent' ? '#ffffff' : bgColor} onChange={e => { setBgColor(e.target.value); setBgHex(e.target.value); }} className="color-big" />
              <div className="hex-input">
                <label>HEX:</label>
                <input type="text" value={bgHex} onChange={e => updateBgHex(e.target.value)} placeholder="#FFFFFF" />
              </div>
              <button onClick={() => setBgColor('transparent')} style={{ marginTop: '8px', width: '100%' }}>Transparent</button>
            </div>
            
            <div className="bg-section">
              <label>Pattern</label>
              <div className="pattern-grid">
                {Object.entries(bgPatterns).map(([k, v]) => (
                  <button key={k} className={`pattern-btn ${bgPattern === k ? 'active' : ''}`} onClick={() => setBgPattern(k)}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="modal-btns">
              <button onClick={resetBackground}>Reset</button>
              <button onClick={() => setShowBgPicker(false)} className="primary">Done</button>
            </div>
          </div>
        </div>
      )}
      
      {showExport && (
        <div className="export-panel">
          <h3>Export (300 DPI)</h3>
          <button onClick={() => exportImg('png')}>PNG</button>
          <button onClick={() => exportImg('jpeg')}>JPEG</button>
        </div>
      )}
      
      {showSaves && (
        <div className="saves-panel">
          <h3>Saved Drawings</h3>
          {saves.length === 0 ? <p>No saves yet</p> : saves.map(s => (
            <div key={s.id} className="save-item">
              <img src={s.data} alt={s.name} />
              <div>
                <strong>{s.name}</strong>
                <small>{s.date}</small>
              </div>
              <button onClick={() => load(s)}>Load</button>
              <button onClick={() => deleteSave(s.id)}>Del</button>
            </div>
          ))}
        </div>
      )}
      
      <div ref={containerRef} className="canvas-container" onWheel={handleWheel} onMouseDown={handlePanStart} onMouseMove={handlePanMove} onMouseUp={handlePanEnd} onMouseLeave={handlePanEnd}>
        <canvas ref={bgCanvasRef} className="bg-canvas" />
        <canvas ref={canvasRef} className="canvas" />
      </div>
      
      <div className="zoom-info">Zoom: {Math.round(view.scale * 100)}%</div>
    </div>
  )
}
