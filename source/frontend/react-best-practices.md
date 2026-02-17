---
title: React Best Practices
sidebar:
  label: React Best Practices
---

# React Best Practices

## Component Design Principles

### 1. Single Responsibility

Each component should do one thing well. If a component grows too large, split it.

```tsx
// ❌ Bad: Too many responsibilities
function UserProfile() {
  return (
    <div>
      <Avatar />
      <UserInfo />
      <UserStats />
      <UserPosts />
      <UserSettings />
    </div>
  );
}

// ✅ Good: Focused components
function UserProfile() {
  return (
    <div>
      <UserHeader />
      <UserContent />
    </div>
  );
}
```

### 2. Prop Drilling vs Context

Use Context API sparingly. Prefer prop drilling for 2-3 levels deep.

```tsx
// ✅ Good: Props for shallow trees
function App() {
  const [theme, setTheme] = useState('dark');
  return <Layout theme={theme} onThemeChange={setTheme} />;
}

// ✅ Good: Context for deep trees
const ThemeContext = createContext();
function App() {
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <Layout />
    </ThemeContext.Provider>
  );
}
```

---

## Hooks Best Practices

### Custom Hooks

Extract reusable logic into custom hooks with the `use` prefix.

```tsx
// Custom hook for API fetching
function useUser(userId: string) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => {
        setUser(data);
        setLoading(false);
      });
  }, [userId]);

  return { user, loading };
}

// Usage
function UserProfile({ userId }) {
  const { user, loading } = useUser(userId);

  if (loading) return <Spinner />;
  return <div>{user.name}</div>;
}
```

### Dependency Arrays

Always specify dependencies correctly to avoid bugs.

```tsx
// ❌ Bad: Missing dependencies
useEffect(() => {
  fetchData(userId);
}, []);

// ✅ Good: All dependencies listed
useEffect(() => {
  fetchData(userId);
}, [userId]);

// ✅ Good: Empty array for mount-only effects
useEffect(() => {
  console.log('Component mounted');
}, []);
```

---

## Performance Optimization

### Memoization

Use `useMemo` and `useCallback` wisely.

```tsx
function SearchResults({ items, query }) {
  // Memoize expensive computations
  const filteredItems = useMemo(() => {
    return items.filter(item =>
      item.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [items, query]);

  // Memoize callbacks passed to children
  const handleClick = useCallback((id) => {
    console.log('Clicked', id);
  }, []);

  return (
    <div>
      {filteredItems.map(item => (
        <Item key={item.id} onClick={handleClick} />
      ))}
    </div>
  );
}
```

### React.memo

Prevent unnecessary re-renders of child components.

```tsx
// Child component that re-renders only when props change
const ExpensiveComponent = React.memo(({ data }) => {
  return <div>{/* Complex rendering logic */}</div>;
});
```

---

## Error Handling

### Error Boundaries

Always wrap components in error boundaries.

```tsx
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Error caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}

// Usage
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

---

## Testing

### Component Tests

Test behavior, not implementation.

```tsx
import { render, screen, fireEvent } from '@testing-library/react';

test('increments counter on button click', () => {
  render(<Counter />);

  const button = screen.getByRole('button', { name: /increment/i });
  const count = screen.getByText(/count: 0/i);

  fireEvent.click(button);

  expect(screen.getByText(/count: 1/i)).toBeInTheDocument();
});
```

---

## Accessibility

Always consider accessibility in your components.

```tsx
function Button({ onClick, children, ariaLabel }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="px-4 py-2 bg-blue-500 text-white rounded"
    >
      {children}
    </button>
  );
}
```
