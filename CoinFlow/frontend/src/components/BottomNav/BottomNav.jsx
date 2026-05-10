import { NavLink } from 'react-router-dom';
import { FiActivity, FiBriefcase, FiTrendingUp, FiBell, FiSearch } from 'react-icons/fi';
import styles from './BottomNav.module.css';

const items = [
  { to: '/dashboard', icon: <FiActivity />, label: 'Stream' },
  { to: '/wallet/demo', icon: <FiBriefcase />, label: 'Wallet' },
  { to: '/trade', icon: <FiTrendingUp />, label: 'Trade' },
  { to: '/search', icon: <FiSearch />, label: 'Search' },
  { to: '/alerts', icon: <FiBell />, label: 'Alerts' },
];

export default function BottomNav() {
  return (
    <nav className={styles.bottomNav}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `${styles.tab} ${isActive ? styles.active : ''}`
          }
        >
          <span className={styles.icon}>{item.icon}</span>
          <span className={styles.label}>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}