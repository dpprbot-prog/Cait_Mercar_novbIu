'use client'

import React, { createContext, useContext } from 'react'
import { WorkerProfile } from '@/actions/auth'

interface AuthContextType {
  user: WorkerProfile | null
}

const AuthContext = createContext<AuthContextType>({ user: null })

export function AuthProvider({ user, children }: { user: WorkerProfile | null, children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={{ user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
