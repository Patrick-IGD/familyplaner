import { expect, test } from '@playwright/test';

// REQ-014 / AC-012: Responsive minimale Haushaltsansicht.
// Full-HD-Kioskgröße und typische Smartphonebreite ohne horizontales
// Scrollen bedienbar; Hauptinformationen und primäre Aktionen erreichbar.

const VIEWPORTS = [
  { name: 'full-hd-kiosk', width: 1920, height: 1080 },
  { name: 'smartphone', width: 390, height: 844 }
];

for (const viewport of VIEWPORTS) {
  test(`household view stays operable without horizontal scrolling at ${viewport.name}`, async ({
    page
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/household');

    // Hauptinformationen sichtbar
    await expect(page.getByRole('heading', { name: /Haushaltsmodus/ })).not.toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Aufgaben heute' })).toBeVisible();
    await expect(page.getByText('offene Entscheidungen')).toBeVisible();

    // Kein horizontales Scrollen: Dokumentbreite überschreitet den Viewport nicht.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // Primäre Informationen sind im sichtbaren Bereich.
    const firstAgendaRow = page.locator('.agenda li').first();
    await expect(firstAgendaRow).toBeVisible();
    const lastTaskRow = page.locator('.tasks li').last();
    await expect(lastTaskRow).toBeVisible();
  });
}
