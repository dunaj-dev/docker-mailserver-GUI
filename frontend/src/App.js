import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Aliases from './pages/Aliases';
import Domains from './pages/Domains';
import Settings from './pages/Settings';
import Container from 'react-bootstrap/Container'; // Import Container
import Row from 'react-bootstrap/Row'; // Import Row
import Col from 'react-bootstrap/Col'; // Import Col

function App() {
  return (
    <div>
      <Navbar />
      <Container fluid>
        <Row>
          {/* Sidebar column */}
          <Col md={2} className="p-0 sidebar-col">
            {' '}
            {/* Added sidebar-col for potential custom styling */}
            <Sidebar />
          </Col>
          {/* Main content column */}
          <Col md={10} className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/aliases" element={<Aliases />} />
              <Route path="/domains" element={<Domains />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Col>{' '}
          {/* Close Main content column */}
        </Row>{' '}
        {/* Close Row */}
      </Container>{' '}
      {/* Close Container */}
    </div>
  );
}

export default App;
