import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import { AppShell } from './components/AppShell'
import { Today } from './pages/Today'
import { Overview } from './pages/Overview'
import { Settings } from './pages/Settings'
import { HabitForm } from './pages/HabitForm'
import { HabitDetail } from './pages/HabitDetail'
import { Profile } from './pages/Profile'
import { Login } from './pages/Login'
import { Privacy } from './pages/Privacy'
import { Landing } from './pages/Landing'
import { ProfileProvider } from './contexts/ProfileContext'
import { HabitsProvider } from './contexts/HabitsContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { VacationsProvider } from './contexts/VacationsContext'

export function App() {
  return (
    <ProfileProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/welcome" element={<Landing />} />
          <Route element={<RequireAuth />}>
            <Route
              element={
                <SettingsProvider>
                  <HabitsProvider>
                    <VacationsProvider>
                      <AppShell />
                    </VacationsProvider>
                  </HabitsProvider>
                </SettingsProvider>
              }
            >
              <Route index element={<Today />} />
              <Route path="overview" element={<Overview />} />
              <Route path="settings" element={<Settings />} />
              <Route path="profile" element={<Profile />} />
              <Route path="habits/new" element={<HabitForm />} />
              <Route path="habits/:id/edit" element={<HabitForm />} />
              <Route path="habits/:id" element={<HabitDetail />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ProfileProvider>
  )
}