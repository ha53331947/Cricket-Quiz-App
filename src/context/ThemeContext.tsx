
import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';

const darkColors = {
  bg: '#090d16',
  text: '#ffffff',
  subText: '#8a9ba8',
  border: '#1f2937',
  header: '#090d16',
  accent: '#00d2ff',
};

const lightColors = {
  bg: '#f5f5f5',
  text: '#333333',
  subText: '#6b7280',
  border: '#e5e7eb',
  header: '#ffffff',
  accent: '#0088aa',
};

type ThemeColors = typeof darkColors;

type ThemeContextType = {
  isDarkMode: boolean;
  toggleTheme: () => void;
  colors: ThemeColors;
};

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: true,
  toggleTheme: () => {},
  colors: darkColors,
});

export function ThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isDarkMode, setIsDarkMode] = useState(true);

  const toggleTheme = () => {
    setIsDarkMode((previous) => !previous);
  };

  const colors: ThemeColors = isDarkMode
    ? darkColors
    : lightColors;

  return (
    <ThemeContext.Provider
      value={{
        isDarkMode,
        toggleTheme,
        colors,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
