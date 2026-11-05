export function formatFacultyEventSerial(serial: number | string): string {
  const value = String(serial).padStart(3, "0");
  return `EVENT #${value}`;
}
