import { Component, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';

interface State { error: Error | null }

/** Keeps one broken page from taking down the whole app; offers a retry instead. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('page crashed', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const ar = document.documentElement.lang !== 'en';
    return (
      <div role="alert" className="card mx-auto mt-10 max-w-md p-6 text-center">
        <p className="text-lg font-black">{ar ? 'صار خطأ في هذه الصفحة' : 'This page hit an error'}</p>
        <p className="mt-1 text-sm text-fg-2">{ar ? 'بياناتك محفوظة. جرّب مرة ثانية.' : 'Your data is safe. Try again.'}</p>
        <pre className="mt-3 max-h-24 overflow-auto rounded-sm bg-surface-2 p-2 text-start text-[11px] text-fg-3" dir="ltr">{this.state.error.message}</pre>
        <button className="mt-4 inline-flex items-center gap-2 rounded-sm bg-accent px-4 py-2 font-bold text-on-accent" onClick={() => this.setState({ error: null })}>
          <RotateCcw size={16} /> {ar ? 'إعادة المحاولة' : 'Retry'}
        </button>
      </div>
    );
  }
}
