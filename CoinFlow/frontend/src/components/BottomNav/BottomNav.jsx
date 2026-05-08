import { NavLink } from 'react-router-dom';
import styles from './BottomNav.module.css';

const items = [
  { to: '/dashboard', icon: '📊', label: 'Stream' },
  { to: '/wallet/demo', icon: '👛', label: 'Wallet' },
  { to: '/trade', icon: '📈', label: 'Trade' },
  { to: '/alerts', icon: '🔔', label: 'Alerts' },
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