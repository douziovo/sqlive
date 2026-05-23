import { vi } from 'vitest';

// Mock Chart.js globally so component tests don't try to create real Chart instances.
// Must use a regular function (not arrow) so `new Chart()` works as a constructor.
function MockChart() {
  return {
    destroy: vi.fn(),
    resize: vi.fn(),
    data: { datasets: [{ data: [] }] },
  };
}
MockChart.register = vi.fn();

vi.mock('chart.js', () => ({
  Chart: MockChart,
  registerables: [],
  register: vi.fn(),
}));
