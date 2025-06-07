import React from "react";
import { Link } from "react-router-dom";

function Navbar({ username, setUsername }) {
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setUsername(null);
  };

  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 24px',
      backgroundColor: '#2c3e50',
      color: '#ecf0f1',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
    }}>
      <Link
        to="/"
        style={{
          fontWeight: '700',
          fontSize: '1.5rem',
          color: '#ecf0f1',
          textDecoration: 'none',
          letterSpacing: '1.2px',
        }}
        aria-label="Go to homepage"
      >
        Textbook Tutor
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {username ? (
          <>
            <span style={{ fontWeight: '600', fontSize: '1rem' }}>
              Hello, <span style={{ color: '#f39c12' }}>{username}</span>
            </span>
            <button
              onClick={logout}
              style={{
                backgroundColor: '#e74c3c',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 16px',
                color: '#fff',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.3s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#c0392b'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#e74c3c'}
              aria-label="Logout"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              style={{
                color: '#ecf0f1',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '1rem',
                padding: '8px 12px',
                borderRadius: '4px',
                transition: 'background-color 0.3s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#34495e'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              aria-label="Login"
            >
              Login
            </Link>
            <Link
              to="/register"
              style={{
                color: '#ecf0f1',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '1rem',
                padding: '8px 12px',
                borderRadius: '4px',
                transition: 'background-color 0.3s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#34495e'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              aria-label="Register"
            >
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
