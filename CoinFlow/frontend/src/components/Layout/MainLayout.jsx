import { Outlet } from 'react-router-dom';
import Navbar from '../Navbar/Navbar';
import Sidebar from '../Sidebar/Sidebar';
import BottomNav from '../BottomNav/BottomNav';
import SearchBar from '../SearchBar/SearchBar';
import styles from './MainLayout.module.css';

export default function MainLayout() {
  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <Navbar />
        <main className={styles.content}>
          <Outlet />
        </main>
        <SearchBar />
        <BottomNav />
      </div>
      <div className={styles.sidebarWrapper}>
        <Sidebar />
      </div>
    </div>
  );
}