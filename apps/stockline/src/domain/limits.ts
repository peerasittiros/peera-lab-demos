/** Row caps per shop (platform §6.3). The server and the browser store check the same numbers. */
export const ROW_CAPS = {
  movements: 2_000,
  items: 500,
  suppliers: 50,
  orders: 300,
  counts: 100,
  categories: 50,
  units: 50,
} as const;
