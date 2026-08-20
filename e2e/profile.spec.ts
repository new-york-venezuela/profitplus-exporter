import { test, expect } from './fixtures';

test.describe('profile', () => {
  test('shows the logged-in user\'s name and email', async ({ userPage }) => {
    await userPage.goto('/profile');
    // Scoped to `main`: the sidebar also links to /profile using the user's
    // name, which would otherwise make this match two elements.
    const main = userPage.getByRole('main');
    await expect(main.getByText('E2E User')).toBeVisible();
    await expect(main.getByText('user@e2e.test')).toBeVisible();
  });
});
