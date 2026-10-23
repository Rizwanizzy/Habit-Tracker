import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import { AppShell } from './components/AppShell'
import { Today } from './pages/Today'
import { Overview } from './pages/Overview'
import { Settings } from './pages/Settings'
import { HabitForm } from './pages/HabitForm'
import { Login } from './pages/Login'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<Today />} />
            <Route path="overview" element={<Overview />} />
            <Route path="settings" element={<Settings />} />
            <Route path="habits/new" element={<HabitForm />} />
            <Route path="habits/:id/edit" element={<HabitForm />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}