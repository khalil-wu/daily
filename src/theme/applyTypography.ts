import { Platform, Text, TextInput } from 'react-native';

import { colors, darkColors, lightColors, typography } from './tokens';

let applied = false;

type ComponentWithDefaultProps = {
  defaultProps?: {
    style?: unknown;
    placeholderTextColor?: string;
  };
};

export function applyTypographyDefaults() {
  if (applied) return;
  applied = true;

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const webFontFamily = typography.fontFamily.sans ?? 'sans-serif';
    const displayFontFamily = typography.fontFamily.display ?? webFontFamily;
    const readingFontFamily = typography.fontFamily.reading ?? webFontFamily;
    document.documentElement.lang = 'zh-CN';
    document.documentElement.style.colorScheme = 'light dark';
    document.documentElement.style.fontFamily = webFontFamily;
    document.body.style.fontFamily = webFontFamily;
    document.body.style.backgroundColor = colors.bgPrimary;
    document.body.style.setProperty('-webkit-font-smoothing', 'antialiased');
    document.body.style.textRendering = 'optimizeLegibility';

    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    viewport?.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');

    const styleId = 'remember-diary-font-reset';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800&family=ZCOOL+KuaiLe&display=swap');
        :root {
          color-scheme: light dark;
          --font-sans: ${webFontFamily};
          --font-display: ${displayFontFamily};
          --font-reading: ${readingFontFamily};
          --remember-bg-primary: ${lightColors.bgPrimary};
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --remember-bg-primary: ${darkColors.bgPrimary};
          }
        }
        html, body, #root,
        *, div, span, p, a, button, input, textarea, select {
          font-family: ${webFontFamily};
          letter-spacing: 0;
          box-sizing: border-box;
          font-synthesis: none;
        }
        html, body, #root {
          width: 100%;
          min-height: 100%;
          overflow-x: hidden;
        }
        body {
          margin: 0;
          background: var(--remember-bg-primary);
          overscroll-behavior-x: none;
        }
        *::before, *::after {
          box-sizing: border-box;
        }
        input, textarea, button, [contenteditable="true"] {
          font-family: ${webFontFamily};
          letter-spacing: 0;
          -webkit-font-smoothing: antialiased;
          text-rendering: optimizeLegibility;
        }
        input, textarea {
          border: 0;
          outline: 0;
          box-shadow: none;
          resize: none;
        }
        input::placeholder, textarea::placeholder {
          font-family: ${readingFontFamily};
        }
      `;
      document.head.appendChild(style);
    }
  }

  const text = Text as unknown as ComponentWithDefaultProps;
  const input = TextInput as unknown as ComponentWithDefaultProps;

  text.defaultProps = {
    ...text.defaultProps,
    style: [
      text.defaultProps?.style,
      {
        fontFamily: typography.fontFamily.sans,
        fontWeight: '400',
        letterSpacing: 0,
        includeFontPadding: false,
      },
    ],
  };

  input.defaultProps = {
    ...input.defaultProps,
    style: [
      input.defaultProps?.style,
      {
        fontFamily: typography.fontFamily.sans,
        fontWeight: '400',
        letterSpacing: 0,
        includeFontPadding: false,
      },
    ],
  };
}
