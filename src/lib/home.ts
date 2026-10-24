export function homeForRole(role: string): string {
  if (role === "GUARDIAN") return "/guardian";
  if (role === "DRIVER") return "/driver";
  return "/owner";
}
