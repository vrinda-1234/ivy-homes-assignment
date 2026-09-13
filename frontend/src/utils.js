export function formatInr(n) {
  if (n == null) return "—";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export function formatCrore(rupees) {
  if (rupees == null) return "—";
  return "₹" + (rupees / 1e7).toFixed(2) + " Cr";
}

export function titleCase(s) {
  if (!s) return "";
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
