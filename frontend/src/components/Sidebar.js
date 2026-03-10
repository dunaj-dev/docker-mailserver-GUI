import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Nav from 'react-bootstrap/Nav'; // Import react-bootstrap Nav

const Sidebar = () => {
  const { t } = useTranslation();

  // Style function to apply styles directly based on isActive
  const getNavLinkStyle = ({ isActive }) => ({
    color: isActive ? '#fff' : '#ced4da',
    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
    textDecoration: 'none',
    display: 'block',
    padding: '10px 15px',
    transition: 'all 0.3s',
  });

  // Hover style is handled by CSS in index.css

  return (
    <Nav className="flex-column sidebar">
      {/* Apply style directly */}
      <Nav.Link as={NavLink} to="/" style={getNavLinkStyle} end>
        <i className="bi bi-speedometer2 me-2"></i> {t('sidebar.dashboard')}
      </Nav.Link>
      <Nav.Link as={NavLink} to="/accounts" style={getNavLinkStyle}>
        <i className="bi bi-person-circle me-2"></i>{' '}
        {t('sidebar.emailAccounts')}
      </Nav.Link>
      <Nav.Link as={NavLink} to="/aliases" style={getNavLinkStyle}>
        <i className="bi bi-arrow-left-right me-2"></i> {t('sidebar.aliases')}
      </Nav.Link>
      <Nav.Link as={NavLink} to="/domains" style={getNavLinkStyle}>
        <i className="bi bi-globe2 me-2"></i> {t('sidebar.domains')}
      </Nav.Link>
      <Nav.Link as={NavLink} to="/settings" style={getNavLinkStyle}>
        <i className="bi bi-gear-fill me-2"></i> {t('sidebar.settings')}
      </Nav.Link>
    </Nav>
  );
};

export default Sidebar;
