// Type declaration for Electron's <webview> tag in React/TSX
// Required because webview is an Electron-specific HTML element not in standard React types

declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      src?: string;
      allowpopups?: boolean | string;
      partition?: string;
      useragent?: string;
      preload?: string;
      httpreferrer?: string;
      nodeintegration?: boolean | string;
      plugins?: boolean | string;
      disablewebsecurity?: boolean | string;
      webpreferences?: string;
      autosize?: boolean | string;
      minwidth?: string;
      minheight?: string;
      maxwidth?: string;
      maxheight?: string;
      style?: React.CSSProperties;
      className?: string;
      ref?: React.Ref<HTMLElement>;
    };
  }
}
