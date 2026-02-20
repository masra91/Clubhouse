import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { GettingStartedSettingsView } from './GettingStartedSettingsView';

function resetStore() {
  useOnboardingStore.setState({
    showOnboarding: false,
    completed: false,
    cohort: null,
    step: 'cohort-select',
    highlightIndex: 0,
  });
}

describe('GettingStartedSettingsView', () => {
  beforeEach(resetStore);

  it('renders the settings view', () => {
    render(<GettingStartedSettingsView />);
    expect(screen.getByTestId('getting-started-settings')).toBeInTheDocument();
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
  });

  it('shows "Start" button when onboarding not completed', () => {
    render(<GettingStartedSettingsView />);
    expect(screen.getByTestId('show-onboarding-btn')).toHaveTextContent('Start');
  });

  it('shows "Show Again" button when onboarding is completed', () => {
    useOnboardingStore.setState({ completed: true });
    render(<GettingStartedSettingsView />);
    expect(screen.getByTestId('show-onboarding-btn')).toHaveTextContent('Show Again');
  });

  it('clicking the button triggers startOnboarding', () => {
    render(<GettingStartedSettingsView />);
    fireEvent.click(screen.getByTestId('show-onboarding-btn'));
    expect(useOnboardingStore.getState().showOnboarding).toBe(true);
  });

  it('does not show topics when no cohort is set', () => {
    render(<GettingStartedSettingsView />);
    expect(screen.queryByTestId('getting-started-topics')).not.toBeInTheDocument();
  });

  it('shows new-dev topics when cohort is new-dev', () => {
    useOnboardingStore.setState({ cohort: 'new-dev' });
    render(<GettingStartedSettingsView />);
    expect(screen.getByTestId('getting-started-topics')).toBeInTheDocument();
    expect(screen.getByText('How Agents Work Under the Hood')).toBeInTheDocument();
    expect(screen.getByText('Let Agents Do the Heavy Lifting')).toBeInTheDocument();
  });

  it('shows experienced-dev topics when cohort is experienced-dev', () => {
    useOnboardingStore.setState({ cohort: 'experienced-dev' });
    render(<GettingStartedSettingsView />);
    expect(screen.getByTestId('getting-started-topics')).toBeInTheDocument();
    expect(screen.getByText('Git Worktrees for Parallel Work')).toBeInTheDocument();
    expect(screen.getByText('Built-in Project Tools')).toBeInTheDocument();
  });

  it('shows seasoned-dev topics when cohort is seasoned-dev', () => {
    useOnboardingStore.setState({ cohort: 'seasoned-dev' });
    render(<GettingStartedSettingsView />);
    expect(screen.getByTestId('getting-started-topics')).toBeInTheDocument();
    expect(screen.getByText('Parallel Agents, Isolated Worktrees')).toBeInTheDocument();
    expect(screen.getByText('Per-Agent Settings')).toBeInTheDocument();
  });

  it('renders 3 topic sections per cohort', () => {
    useOnboardingStore.setState({ cohort: 'new-dev' });
    render(<GettingStartedSettingsView />);
    expect(screen.getByTestId('topic-section-0')).toBeInTheDocument();
    expect(screen.getByTestId('topic-section-1')).toBeInTheDocument();
    expect(screen.getByTestId('topic-section-2')).toBeInTheDocument();
  });

  it('all cohorts share the first topic', () => {
    for (const cohort of ['new-dev', 'experienced-dev', 'seasoned-dev'] as const) {
      useOnboardingStore.setState({ cohort });
      const { unmount } = render(<GettingStartedSettingsView />);
      expect(screen.getByText('Projects, Quick Agents & Durable Agents')).toBeInTheDocument();
      unmount();
    }
  });
});
