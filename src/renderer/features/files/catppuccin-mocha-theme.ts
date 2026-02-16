import type { editor } from 'monaco-editor';

export const CATPPUCCIN_MOCHA_THEME_NAME = 'catppuccin-mocha';

export const catppuccinMochaTheme: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    // General
    { token: '', foreground: 'cdd6f4' },
    { token: 'invalid', foreground: 'f38ba8' },

    // Keywords
    { token: 'keyword', foreground: 'cba6f7' },
    { token: 'keyword.control', foreground: 'cba6f7' },
    { token: 'keyword.operator', foreground: '89dceb' },
    { token: 'storage', foreground: 'cba6f7' },
    { token: 'storage.type', foreground: 'cba6f7' },

    // Strings
    { token: 'string', foreground: 'a6e3a1' },
    { token: 'string.escape', foreground: 'f5c2e7' },
    { token: 'string.regexp', foreground: 'f5c2e7' },

    // Numbers
    { token: 'number', foreground: 'fab387' },
    { token: 'number.hex', foreground: 'fab387' },
    { token: 'constant', foreground: 'fab387' },

    // Comments
    { token: 'comment', foreground: '6c7086', fontStyle: 'italic' },

    // Functions
    { token: 'entity.name.function', foreground: '89b4fa' },
    { token: 'support.function', foreground: '89b4fa' },
    { token: 'meta.function-call', foreground: '89b4fa' },

    // Types & classes
    { token: 'entity.name.type', foreground: 'f9e2af' },
    { token: 'entity.name.class', foreground: 'f9e2af' },
    { token: 'support.type', foreground: 'f9e2af' },
    { token: 'support.class', foreground: 'f9e2af' },
    { token: 'type', foreground: 'f9e2af' },
    { token: 'type.identifier', foreground: 'f9e2af' },

    // Variables
    { token: 'variable', foreground: 'cdd6f4' },
    { token: 'variable.parameter', foreground: 'f38ba8' },
    { token: 'variable.other', foreground: 'cdd6f4' },

    // Properties
    { token: 'variable.property', foreground: '94e2d5' },
    { token: 'support.variable.property', foreground: '94e2d5' },

    // Tags (HTML/XML)
    { token: 'tag', foreground: '89b4fa' },
    { token: 'tag.id.pug', foreground: '89b4fa' },
    { token: 'meta.tag', foreground: '89b4fa' },
    { token: 'attribute.name', foreground: 'f9e2af' },
    { token: 'attribute.value', foreground: 'a6e3a1' },

    // Diff
    { token: 'inserted', foreground: 'a6e3a1' },
    { token: 'deleted', foreground: 'f38ba8' },

    // Punctuation
    { token: 'delimiter', foreground: '9399b2' },
    { token: 'delimiter.bracket', foreground: '9399b2' },
    { token: 'punctuation', foreground: '9399b2' },

    // Meta
    { token: 'meta', foreground: 'fab387' },
    { token: 'annotation', foreground: 'fab387' },
    { token: 'metatag', foreground: 'fab387' },

    // Operators
    { token: 'operator', foreground: '89dceb' },

    // JSON
    { token: 'string.key.json', foreground: '89b4fa' },
    { token: 'string.value.json', foreground: 'a6e3a1' },

    // YAML
    { token: 'type.yaml', foreground: '89b4fa' },

    // Markdown
    { token: 'markup.heading', foreground: '89b4fa', fontStyle: 'bold' },
    { token: 'markup.bold', fontStyle: 'bold' },
    { token: 'markup.italic', fontStyle: 'italic' },
    { token: 'markup.inline', foreground: 'f38ba8' },
    { token: 'markup.underline.link', foreground: '89b4fa' },
  ],
  colors: {
    // Editor
    'editor.background': '#1e1e2e',
    'editor.foreground': '#cdd6f4',
    'editor.lineHighlightBackground': '#31324440',
    'editor.selectionBackground': '#585b7066',
    'editor.inactiveSelectionBackground': '#585b7033',
    'editor.selectionHighlightBackground': '#585b7040',
    'editor.wordHighlightBackground': '#585b7040',
    'editor.wordHighlightStrongBackground': '#585b7055',
    'editor.findMatchBackground': '#f9e2af40',
    'editor.findMatchHighlightBackground': '#f9e2af25',

    // Cursor
    'editorCursor.foreground': '#f5e0dc',

    // Line numbers
    'editorLineNumber.foreground': '#6c7086',
    'editorLineNumber.activeForeground': '#cdd6f4',

    // Indentation guides
    'editorIndentGuide.background': '#31324480',
    'editorIndentGuide.activeBackground': '#45475a80',

    // Gutter
    'editorGutter.background': '#1e1e2e',

    // Brackets
    'editorBracketMatch.background': '#585b7050',
    'editorBracketMatch.border': '#585b70',

    // Widgets (find/replace, etc.)
    'editorWidget.background': '#181825',
    'editorWidget.border': '#313244',
    'editorWidget.foreground': '#cdd6f4',

    // Scrollbar
    'scrollbar.shadow': '#11111b00',
    'scrollbarSlider.background': '#45475a50',
    'scrollbarSlider.hoverBackground': '#45475a80',
    'scrollbarSlider.activeBackground': '#585b70',

    // Input (find box)
    'input.background': '#313244',
    'input.foreground': '#cdd6f4',
    'input.border': '#45475a',
    'input.placeholderForeground': '#6c7086',
    'inputOption.activeBorder': '#89b4fa',

    // Dropdown
    'dropdown.background': '#181825',
    'dropdown.border': '#313244',
    'dropdown.foreground': '#cdd6f4',

    // List (autocomplete, etc.)
    'list.activeSelectionBackground': '#45475a',
    'list.activeSelectionForeground': '#cdd6f4',
    'list.hoverBackground': '#313244',
    'list.focusBackground': '#45475a',
    'list.highlightForeground': '#89b4fa',

    // Overview ruler (scrollbar decorations)
    'editorOverviewRuler.border': '#1e1e2e',
    'editorOverviewRuler.findMatchForeground': '#f9e2af60',
    'editorOverviewRuler.selectionHighlightForeground': '#585b7060',

    // Suggest widget (IntelliSense)
    'editorSuggestWidget.background': '#181825',
    'editorSuggestWidget.border': '#313244',
    'editorSuggestWidget.foreground': '#cdd6f4',
    'editorSuggestWidget.selectedBackground': '#45475a',
    'editorSuggestWidget.highlightForeground': '#89b4fa',

    // Peek view
    'peekView.border': '#45475a',
    'peekViewEditor.background': '#181825',
    'peekViewResult.background': '#181825',
    'peekViewTitle.background': '#181825',

    // Minimap (disabled but just in case)
    'minimap.background': '#1e1e2e',
  },
};
