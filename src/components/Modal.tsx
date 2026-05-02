'use client'

import React from 'react'
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm?: () => void
  title: string
  message: string
  type?: 'danger' | 'success' | 'info' | 'warning'
  confirmText?: string
  cancelText?: string
  showConfirm?: boolean
}

export default function Modal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'info',
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  showConfirm = true
}: ModalProps) {
  if (!isOpen) return null

  const getIcon = () => {
    switch (type) {
      case 'danger': return <AlertTriangle size={32} color="#ef4444" />
      case 'warning': return <AlertTriangle size={32} color="#eab308" />
      case 'success': return <CheckCircle size={32} color="#22c55e" />
      default: return <Info size={32} color="var(--accent)" />
    }
  }

  const getButtonColor = () => {
    switch (type) {
      case 'danger': return '#ef4444'
      case 'warning': return '#eab308'
      case 'success': return '#22c55e'
      default: return 'var(--accent)'
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      animation: 'fadeIn 0.2s ease'
    }}>
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: 20,
        width: '100%',
        maxWidth: 400,
        padding: 30,
        textAlign: 'center',
        position: 'relative',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}>
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 15,
            right: 15,
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.3)',
            cursor: 'pointer'
          }}
        >
          <X size={20} />
        </button>

        <div style={{ marginBottom: 15 }}>
          {getIcon()}
        </div>

        <h3 style={{ color: '#fff', fontSize: 20, marginBottom: 10, fontWeight: 700 }}>
          {title}
        </h3>
        
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.6, marginBottom: 25 }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 12,
              border: '1px solid var(--border-color)',
              background: 'rgba(255,255,255,0.05)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14
            }}
          >
            {cancelText}
          </button>
          
          {showConfirm && (
            <button 
              onClick={() => {
                onConfirm?.()
                onClose()
              }}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 12,
                border: 'none',
                background: getButtonColor(),
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 14
              }}
            >
              {confirmText}
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
