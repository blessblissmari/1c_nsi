import { BrowserRouter, Routes, Route } from 'react-router'
import { AppLayout } from './components/layout/AppLayout'
import { HierarchyWorkspace } from './components/workspaces/HierarchyWorkspace'
import { UpperLevelsWorkspace } from './components/workspaces/UpperLevelsWorkspace'
import { MassProcessingWorkspace } from './components/workspaces/MassProcessingWorkspace'
import { MaintenanceWorkspace } from './components/workspaces/MaintenanceWorkspace'
import { TkWorkspace } from './components/workspaces/TkWorkspace'
import { SpecificationsWorkspace } from './components/workspaces/SpecificationsWorkspace'
import { ReliabilityWorkspace } from './components/workspaces/ReliabilityWorkspace'
import { ChatWorkspace } from './components/workspaces/ChatWorkspace'
import { ParserWorkspace } from './components/workspaces/ParserWorkspace'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HierarchyWorkspace />} />
          <Route path="/hierarchy" element={<HierarchyWorkspace />} />
          <Route path="/upper-levels" element={<UpperLevelsWorkspace />} />
          <Route path="/mass-processing" element={<MassProcessingWorkspace />} />
          <Route path="/maintenance" element={<MaintenanceWorkspace />} />
          <Route path="/tk" element={<TkWorkspace />} />
          <Route path="/specifications" element={<SpecificationsWorkspace />} />
          <Route path="/reliability" element={<ReliabilityWorkspace />} />
          <Route path="/chat" element={<ChatWorkspace />} />
          <Route path="/parser" element={<ParserWorkspace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
