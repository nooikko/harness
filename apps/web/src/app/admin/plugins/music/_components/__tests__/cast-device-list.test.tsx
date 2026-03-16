import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../_actions/identify-device', () => ({
  identifyDevice: vi.fn(),
}));

vi.mock('../../_actions/set-device-alias', () => ({
  setDeviceAlias: vi.fn(),
}));

const AVAILABLE_DEVICE = {
  id: 'd1',
  name: 'Living Room Speaker',
  model: 'Nest Audio',
  status: 'available' as const,
};

const PLAYING_DEVICE = {
  id: 'd2',
  name: 'Kitchen Display',
  model: 'Nest Hub',
  status: 'playing' as const,
};

const OFFLINE_DEVICE = {
  id: 'd3',
  name: 'Bedroom Speaker',
  model: 'Nest Mini',
  status: 'offline' as const,
};

const ALIASED_DEVICE = {
  id: 'd4',
  name: 'Office Cast',
  model: 'Chromecast',
  alias: 'My Office',
  status: 'available' as const,
};

const mockFetchDevices = (devices: Array<Record<string, unknown>>) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ devices }),
      }),
    ),
  );
};

describe('CastDeviceList', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeletons initially', async () => {
    // Never-resolving fetch to keep loading state
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise(() => {
            /* never resolves */
          }),
      ),
    );

    const { CastDeviceList } = await import('../cast-device-list');

    const { container } = render(<CastDeviceList />);

    // Should not show the count badge while loading
    expect(screen.queryByText('0')).toBeNull();
    // Skeletons are rendered (two skeleton divs)
    const skeletons = container.querySelectorAll('[class*="h-12"]');
    expect(skeletons.length).toBeGreaterThanOrEqual(2);
  });

  it('renders empty state when fetch returns no devices', async () => {
    mockFetchDevices([]);

    const { CastDeviceList } = await import('../cast-device-list');

    render(<CastDeviceList />);

    await waitFor(() => {
      expect(screen.getByText('No Cast devices found')).toBeDefined();
    });

    expect(screen.getByText('Ensure devices are on the same network as the orchestrator.')).toBeDefined();
  });

  it('shows device count badge after loading', async () => {
    mockFetchDevices([AVAILABLE_DEVICE, PLAYING_DEVICE]);

    const { CastDeviceList } = await import('../cast-device-list');

    render(<CastDeviceList />);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeDefined();
    });
  });

  it('renders device names when fetch returns devices', async () => {
    mockFetchDevices([AVAILABLE_DEVICE, PLAYING_DEVICE]);

    const { CastDeviceList } = await import('../cast-device-list');

    render(<CastDeviceList />);

    await waitFor(() => {
      expect(screen.getByText('Living Room Speaker')).toBeDefined();
      expect(screen.getByText('Kitchen Display')).toBeDefined();
    });
  });

  it('renders Test button per device', async () => {
    mockFetchDevices([AVAILABLE_DEVICE, PLAYING_DEVICE]);

    const { CastDeviceList } = await import('../cast-device-list');

    render(<CastDeviceList />);

    await waitFor(() => {
      const testButtons = screen.getAllByText('Test');
      expect(testButtons).toHaveLength(2);
    });
  });

  it('renders error state when fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({}),
        }),
      ),
    );

    const { CastDeviceList } = await import('../cast-device-list');

    render(<CastDeviceList />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load devices')).toBeDefined();
    });
  });

  it('renders error state when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('Network error'))),
    );

    const { CastDeviceList } = await import('../cast-device-list');

    render(<CastDeviceList />);

    await waitFor(() => {
      expect(screen.getByText('Could not reach orchestrator')).toBeDefined();
    });
  });

  it('renders model name for each device', async () => {
    mockFetchDevices([AVAILABLE_DEVICE, PLAYING_DEVICE]);

    const { CastDeviceList } = await import('../cast-device-list');

    render(<CastDeviceList />);

    await waitFor(() => {
      expect(screen.getByText('Nest Audio')).toBeDefined();
      expect(screen.getByText('Nest Hub')).toBeDefined();
    });
  });

  it('renders alias as display name and original name in parentheses', async () => {
    mockFetchDevices([ALIASED_DEVICE]);

    const { CastDeviceList } = await import('../cast-device-list');

    render(<CastDeviceList />);

    await waitFor(() => {
      expect(screen.getByText('My Office')).toBeDefined();
      // Model + original name in subtitle
      expect(screen.getByText(/Chromecast/)).toBeDefined();
      expect(screen.getByText(/\(Office Cast\)/)).toBeDefined();
    });
  });

  it('does not show original name in parentheses when no alias', async () => {
    mockFetchDevices([AVAILABLE_DEVICE]);

    const { CastDeviceList } = await import('../cast-device-list');

    render(<CastDeviceList />);

    await waitFor(() => {
      expect(screen.getByText('Living Room Speaker')).toBeDefined();
      expect(screen.getByText('Nest Audio')).toBeDefined();
      // Should NOT have parenthesized original name
      expect(screen.queryByText(/\(Living Room Speaker\)/)).toBeNull();
    });
  });

  it('disables Test button for offline devices', async () => {
    mockFetchDevices([OFFLINE_DEVICE]);

    const { CastDeviceList } = await import('../cast-device-list');

    render(<CastDeviceList />);

    await waitFor(() => {
      expect(screen.getByText('Bedroom Speaker')).toBeDefined();
    });

    const testButton = screen.getByText('Test').closest('button');
    expect(testButton?.disabled).toBe(true);
  });

  it('calls identifyDevice when Test is clicked', async () => {
    const { identifyDevice } = await import('../../_actions/identify-device');
    vi.mocked(identifyDevice).mockResolvedValue({ success: true });
    mockFetchDevices([AVAILABLE_DEVICE]);

    const { CastDeviceList } = await import('../cast-device-list');
    const user = userEvent.setup();

    render(<CastDeviceList />);

    await waitFor(() => {
      expect(screen.getByText('Living Room Speaker')).toBeDefined();
    });

    await user.click(screen.getByText('Test'));

    expect(identifyDevice).toHaveBeenCalledWith('d1');
  });

  it('shows ... while identifying a device', async () => {
    const { identifyDevice } = await import('../../_actions/identify-device');

    let resolveIdentify: (value: { success: boolean }) => void;
    vi.mocked(identifyDevice).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveIdentify = resolve;
        }),
    );
    mockFetchDevices([AVAILABLE_DEVICE]);

    const { CastDeviceList } = await import('../cast-device-list');
    const user = userEvent.setup();

    render(<CastDeviceList />);

    await waitFor(() => {
      expect(screen.getByText('Living Room Speaker')).toBeDefined();
    });

    await user.click(screen.getByText('Test'));

    expect(screen.getByText('...')).toBeDefined();

    resolveIdentify!({ success: true });

    await waitFor(() => {
      expect(screen.getByText('Test')).toBeDefined();
    });
  });

  it('shows error when identifyDevice fails', async () => {
    const { identifyDevice } = await import('../../_actions/identify-device');
    vi.mocked(identifyDevice).mockResolvedValue({
      success: false,
      error: 'Device unreachable',
    });
    mockFetchDevices([AVAILABLE_DEVICE]);

    const { CastDeviceList } = await import('../cast-device-list');
    const user = userEvent.setup();

    render(<CastDeviceList />);

    await waitFor(() => {
      expect(screen.getByText('Living Room Speaker')).toBeDefined();
    });

    await user.click(screen.getByText('Test'));

    await waitFor(() => {
      expect(screen.getByText('Device unreachable')).toBeDefined();
    });
  });

  it('shows fallback error when identifyDevice fails without message', async () => {
    const { identifyDevice } = await import('../../_actions/identify-device');
    vi.mocked(identifyDevice).mockResolvedValue({ success: false });
    mockFetchDevices([AVAILABLE_DEVICE]);

    const { CastDeviceList } = await import('../cast-device-list');
    const user = userEvent.setup();

    render(<CastDeviceList />);

    await waitFor(() => {
      expect(screen.getByText('Living Room Speaker')).toBeDefined();
    });

    await user.click(screen.getByText('Test'));

    await waitFor(() => {
      expect(screen.getByText('Failed to identify device')).toBeDefined();
    });
  });

  it('enters edit mode when pencil button is clicked', async () => {
    mockFetchDevices([AVAILABLE_DEVICE]);

    const { CastDeviceList } = await import('../cast-device-list');
    const user = userEvent.setup();

    render(<CastDeviceList />);

    await waitFor(() => {
      expect(screen.getByText('Living Room Speaker')).toBeDefined();
    });

    // Click the "Set alias" button (pencil icon)
    const aliasButton = screen.getByTitle('Set alias');
    await user.click(aliasButton);

    // Should show input with device name pre-filled
    const input = screen.getByRole('textbox');
    expect(input).toBeDefined();
    expect((input as HTMLInputElement).value).toBe('Living Room Speaker');

    // Should show Save and Cancel buttons
    expect(screen.getByText('Save')).toBeDefined();
    expect(screen.getByText('Cancel')).toBeDefined();
  });

  it('pre-fills alias when device already has one', async () => {
    mockFetchDevices([ALIASED_DEVICE]);

    const { CastDeviceList } = await import('../cast-device-list');
    const user = userEvent.setup();

    render(<CastDeviceList />);

    await waitFor(() => {
      expect(screen.getByText('My Office')).toBeDefined();
    });

    await user.click(screen.getByTitle('Set alias'));

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('My Office');
  });

  it('saves alias on Save button click', async () => {
    const { setDeviceAlias } = await import('../../_actions/set-device-alias');
    vi.mocked(setDeviceAlias).mockResolvedValue({ success: true });
    mockFetchDevices([AVAILABLE_DEVICE]);

    const { CastDeviceList } = await import('../cast-device-list');
    const user = userEvent.setup();

    render(<CastDeviceList />);

    await waitFor(() => {
      expect(screen.getByText('Living Room Speaker')).toBeDefined();
    });

    await user.click(screen.getByTitle('Set alias'));

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'New Alias');

    await user.click(screen.getByText('Save'));

    expect(setDeviceAlias).toHaveBeenCalledWith('d1', 'New Alias');

    await waitFor(() => {
      expect(screen.getByText('New Alias')).toBeDefined();
      // Input should be gone (exited edit mode)
      expect(screen.queryByRole('textbox')).toBeNull();
    });
  });

  it('saves alias on Enter key', async () => {
    const { setDeviceAlias } = await import('../../_actions/set-device-alias');
    vi.mocked(setDeviceAlias).mockResolvedValue({ success: true });
    mockFetchDevices([AVAILABLE_DEVICE]);

    const { CastDeviceList } = await import('../cast-device-list');
    const user = userEvent.setup();

    render(<CastDeviceList />);

    await waitFor(() => {
      expect(screen.getByText('Living Room Speaker')).toBeDefined();
    });

    await user.click(screen.getByTitle('Set alias'));

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Enter Alias');
    await user.keyboard('{Enter}');

    expect(setDeviceAlias).toHaveBeenCalledWith('d1', 'Enter Alias');
  });

  it('cancels edit on Cancel button click', async () => {
    mockFetchDevices([AVAILABLE_DEVICE]);

    const { CastDeviceList } = await import('../cast-device-list');
    const user = userEvent.setup();

    render(<CastDeviceList />);

    await waitFor(() => {
      expect(screen.getByText('Living Room Speaker')).toBeDefined();
    });

    await user.click(screen.getByTitle('Set alias'));

    expect(screen.getByRole('textbox')).toBeDefined();

    await user.click(screen.getByText('Cancel'));

    // Back to display mode
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Living Room Speaker')).toBeDefined();
  });

  it('cancels edit on Escape key', async () => {
    mockFetchDevices([AVAILABLE_DEVICE]);

    const { CastDeviceList } = await import('../cast-device-list');
    const user = userEvent.setup();

    render(<CastDeviceList />);

    await waitFor(() => {
      expect(screen.getByText('Living Room Speaker')).toBeDefined();
    });

    await user.click(screen.getByTitle('Set alias'));

    expect(screen.getByRole('textbox')).toBeDefined();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Living Room Speaker')).toBeDefined();
  });

  it('shows error when setDeviceAlias fails', async () => {
    const { setDeviceAlias } = await import('../../_actions/set-device-alias');
    vi.mocked(setDeviceAlias).mockResolvedValue({
      success: false,
      error: 'Alias too long',
    });
    mockFetchDevices([AVAILABLE_DEVICE]);

    const { CastDeviceList } = await import('../cast-device-list');
    const user = userEvent.setup();

    render(<CastDeviceList />);

    await waitFor(() => {
      expect(screen.getByText('Living Room Speaker')).toBeDefined();
    });

    await user.click(screen.getByTitle('Set alias'));
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Alias too long')).toBeDefined();
    });
  });

  it('shows fallback error when setDeviceAlias fails without message', async () => {
    const { setDeviceAlias } = await import('../../_actions/set-device-alias');
    vi.mocked(setDeviceAlias).mockResolvedValue({ success: false });
    mockFetchDevices([AVAILABLE_DEVICE]);

    const { CastDeviceList } = await import('../cast-device-list');
    const user = userEvent.setup();

    render(<CastDeviceList />);

    await waitFor(() => {
      expect(screen.getByText('Living Room Speaker')).toBeDefined();
    });

    await user.click(screen.getByTitle('Set alias'));
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Failed to save alias')).toBeDefined();
    });
  });

  it('hides action buttons while editing', async () => {
    mockFetchDevices([AVAILABLE_DEVICE]);

    const { CastDeviceList } = await import('../cast-device-list');
    const user = userEvent.setup();

    render(<CastDeviceList />);

    await waitFor(() => {
      expect(screen.getByText('Living Room Speaker')).toBeDefined();
    });

    // Before edit: Test and pencil buttons visible
    expect(screen.getByTitle('Set alias')).toBeDefined();
    expect(screen.getByText('Test')).toBeDefined();

    await user.click(screen.getByTitle('Set alias'));

    // During edit: Test and pencil buttons should be hidden
    expect(screen.queryByTitle('Set alias')).toBeNull();
    expect(screen.queryByTitle('Test / Identify')).toBeNull();
  });

  it('renders all three device statuses with correct labels', async () => {
    mockFetchDevices([AVAILABLE_DEVICE, PLAYING_DEVICE, OFFLINE_DEVICE]);

    const { CastDeviceList } = await import('../cast-device-list');

    render(<CastDeviceList />);

    await waitFor(() => {
      expect(screen.getByText('Living Room Speaker')).toBeDefined();
    });

    // Status indicators via title attributes
    expect(screen.getByTitle('Available')).toBeDefined();
    expect(screen.getByTitle('Playing')).toBeDefined();
    expect(screen.getByTitle('Offline')).toBeDefined();
  });
});
