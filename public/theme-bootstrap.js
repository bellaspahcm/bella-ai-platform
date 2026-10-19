(() => {
  try {
    const path = window.location.pathname || "";
    
    // Skip theme bootstrap for auth pages (login, signup)
    if (path === "/login" || path.startsWith("/login/") || 
        path === "/signup" || path.startsWith("/signup/") ||
        path.includes("/(auth)/")) {
      return; // Keep default pink gradient for auth pages
    }
    
    const isAppShell =
      path === "/dashboard" ||
      path.startsWith("/dashboard/") ||
      path === "/ktv" ||
      path.startsWith("/ktv/");

    if (!isAppShell) return;

    const root = document.documentElement;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const setThemeColor = (color) => {
      if (themeMeta) themeMeta.setAttribute("content", color);
    };
    const setRootVars = (vars) => {
      Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
    };

    root.dataset.tenantModule = "pending";
    setRootVars({
      "--primary": "#334155",
      "--primary-hover": "#1e293b",
      "--accent": "#94a3b8",
      "--background": "#f8fafc",
      "--foreground": "#0F172A",
      "--border": "#e2e8f0",
      "--input": "#e2e8f0",
      "--ring": "#64748b",
    });
    setThemeColor("#f8fafc");

    // Storage cannot prove the authenticated tenant. Live dashboard context owns
    // the first branded paint, including explicit tenant colors.
  } catch {
    const path = window.location.pathname || "";
    if (
      path === "/dashboard" ||
      path.startsWith("/dashboard/") ||
      path === "/ktv" ||
      path.startsWith("/ktv/")
    ) {
      document.documentElement.dataset.tenantModule = "pending";
    }
  }
})();
