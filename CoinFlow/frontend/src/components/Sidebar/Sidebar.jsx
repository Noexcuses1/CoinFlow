import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { FiActivity, FiBriefcase, FiTrendingUp, FiBell, FiSearch } from 'react-icons/fi';
import styles from './Sidebar.module.css';

const navItems = [
  { to: '/dashboard', icon: <FiActivity />, label: 'Stream' },
  { to: '/wallet', icon: <FiBriefcase />, label: 'Wallet' },
  { to: '/trade', icon: <FiTrendingUp />, label: 'Trade' },
  { to: '/search', icon: <FiSearch />, label: 'Search' }, 
  { to: '/alerts', icon: <FiBell />, label: 'Alerts' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <button
        className={styles.toggleBtn}
        onClick={() => setCollapsed(prev => !prev)}
        aria-label="Toggle sidebar"
      >
        {collapsed ? '▶' : '◀'}
      </button>

      <nav className={styles.nav}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `${styles.link} ${isActive ? styles.active : ''}`
            }
          >
            <span className={styles.icon}>{item.icon}</span>
            {!collapsed && <span className={styles.label}>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className={styles.footer}>
        <div className={styles.online}>
          <span className={styles.dot}></span>
          {!collapsed && <span> connected</span>}
        </div>
      </div>
    </aside>
  );
}