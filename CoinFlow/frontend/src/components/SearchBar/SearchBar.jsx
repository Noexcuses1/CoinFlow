import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SearchBar.module.css';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/trade?token=${query.trim()}`);
      setQuery('');
    }
  };

  return (
    <form className={`glass-panel ${styles.searchBar}`} onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Paste token address..."
        className={styles.input}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button type="submit" className={styles.button}>Search</button>
    </form>
  );
}