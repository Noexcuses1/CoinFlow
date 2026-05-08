import { NavLink } from 'react-router-dom';
import styles from './Sidebar.module.css';

const navItems = [
  { to: '/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/wallet/demo', icon: '👛', label: 'Wallet' },
  { to: '/trade', icon: '📈', label: 'Trade' },
  { to: '/alerts', icon: '🔔', label: 'Alerts' },
];

export default function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.nav}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `${styles.link} ${isActive ? styles.active : ''}`
            }
          >
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
          </NavLink>
        ))}
      </div>
      <div className={styles.footer}>
        <div className={styles.online}>
          <span className={styles.dot}></span> connected
        </div>
      </div>
    </aside>
  );
}