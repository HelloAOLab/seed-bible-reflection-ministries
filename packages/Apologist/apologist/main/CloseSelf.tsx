const G = globalThis as any;

G.RemoveApplicationByLabel(G.ActiveMoreApp);
G.makingApp = null;
G.SetActiveMoreApp(null);
G.ActiveMoreApp = null;
