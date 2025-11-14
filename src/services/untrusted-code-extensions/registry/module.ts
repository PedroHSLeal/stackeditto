const modulesMap = new Map<string, string>();

export function registerUntrustedModule(scriptPath: string, scriptContent: string) {
  const blob = new Blob([scriptContent], { type: 'application/javascript' });
  const moduleUrl = URL.createObjectURL(blob);

  modulesMap.set(scriptPath, moduleUrl);
}

export function getModule(scriptPath: string): string | null {
  return modulesMap.has(scriptPath) ? modulesMap.get(scriptPath)! : null;
}