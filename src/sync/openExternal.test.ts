import { describe, expect, it, vi } from 'vitest';
import { openLink } from './openExternal';

describe('opening a link to a web page', () => {
  const url = 'https://github.com/goerks/GetThingsDone/issues/1';

  it('AC4.1 opens the issue through the app on the desktop and takes the click over', async () => {
    // Given the desktop app
    const event = { preventDefault: vi.fn() };
    const open = vi.fn().mockResolvedValue(undefined);
    // When the link is clicked
    openLink(event, url, { desktop: true, open });
    // Then the address goes to the default browser and the web view does not follow the link itself
    expect(event.preventDefault).toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(url);
  });

  it('AC4.1 leaves the link to the browser in the browser build', () => {
    const event = { preventDefault: vi.fn() };
    const open = vi.fn();
    openLink(event, url, { desktop: false, open });
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('AC4.1 opens a new window when the app cannot open the address', async () => {
    const opened = vi.spyOn(window, 'open').mockReturnValue(null);
    const open = vi.fn().mockRejectedValue(new Error('no browser'));
    openLink({ preventDefault: vi.fn() }, url, { desktop: true, open });
    await vi.waitFor(() => expect(opened).toHaveBeenCalledWith(url, '_blank', 'noopener,noreferrer'));
    opened.mockRestore();
  });
});
