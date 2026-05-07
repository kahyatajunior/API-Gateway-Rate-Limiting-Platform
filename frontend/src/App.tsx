import { Link, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Docs from './pages/Docs';

function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>API Gateway</h1>
        <nav>
          <Link to="/">Dashboard</Link>
          <Link to="/docs">Docs</Link>
        </nav>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/docs" element={<Docs />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
