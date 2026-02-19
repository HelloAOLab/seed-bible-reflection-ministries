const { useEffect, useState, useRef, render, useMemo } = os.appHooks;

import { MouseMoveProvider } from "app.hooks.mouseMove";
import Layout from "app.components.layout";
import { SplitApp, useDivSpliter } from "app.hooks.divSpliter";
import {
  ThePage,
  ThePageWithPanel,
  ThePageWithEditor,
} from "app.components.thePage";
import { useBibleContext } from "app.hooks.bibleVariables";
import { useTabsContext } from "app.hooks.tabs";
import { useSideBarContext } from "app.hooks.sideBar";
import { PackageManager } from "app.packager.main";
import { DragDropOverlay } from "app.main.dragOverlay";
<<<<<<< HEAD
import { READY_THEMES } from "app.components.themeSettings";
=======
import { MainController } from "app.controller.MainController";
import { calcThemeCSS } from "app.main.cssUtil";

>>>>>>> sync/19-1-2026@7-41-14.98
globalThis.AppStartedSuccessfully = false;

//this for defining nav functions globaly
globalThis.Open = () => {};
globalThis.OpenNextChapter = () => {};
globalThis.OpenPrevChapter = () => {};
globalThis.SpaceLayouts = {}; // To store layout per space
globalThis.SpaceScreens = {}; // Already used for screen count
globalThis.CheckToolbarOverflow = () => {};

/**
 * TODO: Once casual supports it, the prop tsx types should be added back in.
 */
export const MainContent = (
  { controller } /*: { controller: MainController }*/
) => {
  if (configBot.tags.extensions) return <PackageManager />;
  const { screens, fullScreen, setFullScreen } = useBibleContext();
  const { collapsed, sidebarWidth, setSidebarWidth, themeColors } =
    useSideBarContext();
  const { tabs, activeSpace, getAllTabsInSpace, spaces } = useTabsContext();
  const [started, setStarted] = useState(false);

  const {
    containerProps,
    updateContainerSize,
    updateApplication,
    removeApplicationByID,
    replaceApplication,
    addApplication,
    resetApps,
    removeApplication,
    setApps,
  } = useDivSpliter({
    components: [
      {
        id: `panel-${0}-${activeSpace}`,
        App: (
          <ThePageWithEditor
            panelId={`panel-${0}-${activeSpace}`}
            tab={tabs[0]}
          />
        ),
        to: "panel",
      },
      // { id: `panel-${1}-${activeSpace}`, App: <TestingApp panelId={`panel-${1}-${activeSpace}`} />, to: 'panel' },
    ],
    split: true,
    containerWidth: 1150,
    containerHeight: 920,
    minSize: 100,
  });

  useEffect(() => {
    controller.linkViewMethod("addApplication", addApplication);
    controller.linkViewMethod("removeApplication", removeApplication);
    controller.linkViewMethod("removeApplicationById", removeApplicationByID);
    controller.linkViewMethod("replaceApplication", replaceApplication);
    controller.linkViewMethod("updateApplication", updateApplication);

    setStarted(true);
    const handleContextMenu = (e) => {
      e.preventDefault(); // Disable right-click
    };

    window.addEventListener("contextmenu", handleContextMenu);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  useEffect(() => {
    if (!started) return;

    setApps((prevApps) => {
      const newApps = [];

      for (let i = 0; i < screens.value; i++) {
        const id = `panel-${i}-${activeSpace}`;
        if (prevApps[i]) {
          newApps.push({
            ...prevApps[i],
            id,
          });
        } else {
          newApps.push({
            id,
            App: (
              <ThePageWithEditor
                key={id}
                panelId={id}
                tab={globalThis.PanelTabsMap[id]}
              />
            ),
            to: "window",
            tabData: globalThis.PanelTabsMap[id],
          });
        }
      }

      return [...newApps];
    });

    globalThis.SpaceScreens[activeSpace] = screens.value;
  }, [screens]);

  globalThis.LocateCanvas = () => {
    const nodes = document.querySelectorAll(".mainCanvas");
    const el = nodes[nodes.length - 1]; // last match
    if (!el) {
      configBot.tags.gridPortal = null;
      configBot.tags.mapPortal = null;
      return;
    }

    // Viewport-relative bounds:
    const { left, top, width, height } = el.getBoundingClientRect();

    // Get border radius from computed style
    const style = window.getComputedStyle(el);
    const borderRadius = style.borderRadius;
    // or if you need individual corners:
    const borderTopLeft = style.borderTopLeftRadius;
    const borderTopRight = style.borderTopRightRadius;
    const borderBottomLeft = style.borderBottomLeftRadius;
    const borderBottomRight = style.borderBottomRightRadius;

    configBot.tags.gridPortal = globalThis?.defaultPortalName || "thePortal";
    globalThis.SetCanvasPositions({
      // ...style,
      left,
      top,
      width,
      height,
      borderRadius, // shorthand
    });
  };

  useEffect(() => {
    globalThis.LocateCanvas();
  }, [
    screens,
    containerProps.apps,
    containerProps.leftWidth,
    containerProps.topHeight,
  ]);

  useEffect(() => {
    if (!started) return;

    const savedScreens = globalThis.SpaceScreens[activeSpace] || 1;
    const newApps = [];

    for (let i = 0; i < savedScreens; i++) {
      const id = `panel-${i}-${activeSpace}`;
      newApps.push({
        id,
        App: (
          <ThePageWithEditor
            key={id}
            panelId={id}
            tab={globalThis.PanelTabsMap[id]}
          />
        ),
        to: "window",
        tabData: globalThis.PanelTabsMap[id],
      });
    }

    setApps(newApps); // ✅ Update all at once

    setTimeout(() => {
      if (tabs.length === 1 && savedScreens === 1) {
        globalThis.UpdateTab(tabs[0]);
      }
      globalThis.AppStartedSuccessfully = true;
    }, 0);
    globalThis.SpaceScreens[activeSpace] = savedScreens;
  }, [activeSpace]);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const onResize = () =>
      handleResize(setIsMobile, updateContainerSize, fullScreen, sidebarWidth);
    onResize();
    window?.addEventListener("resize", onResize);
    return () => {
      window?.removeEventListener("resize", onResize);
    };
  }, [collapsed, fullScreen, sidebarWidth]);

  useEffect(() => {
    CheckToolbarOverflow();
  }, [containerProps.leftWidth, containerProps.topHeight]);

<<<<<<< HEAD
  //   const vars = Object.entries(colors).map(
  //     ([key, value]) => `--${key}: ${value};`
  //   );

  //   return `:root {\n  ${vars.join("\n  ")}\n}`;
  // };
  const LigonierTheme = {
    firstToolbarbutton: "#dfdede",
    "filter-mode": "invert(0)",
    "secondary-filter-mode": "invert(100%)",
    // Main colors
    primaryColor: "#FFFFFF",
    secondaryColor: "#2563EB",
    tertiaryColor: "#DBEAFE",
    // Container backgrounds
    themeSideMenu: "#F9FAFB",
    panelBackground: "#F3F4F6",
    // Tab
    tabSelection: "#2563EB",
    activeTabBackground: "#DBEAFE",
    activeTabText: "#1E3A8A",
    activeTabBorder: "#2563EB",
    activeTabFill: "#2563EB94",
    simpleTabText: "#6B7280",
    inactiveTabText: "#6B7280",
    // Buttons
    primaryButton: "#2563EB",
    primaryButtonColor: "#FFFFFF",
    primaryButtonBorder: "#2563EB",
    primaryButtonFill: "#2563EB",
    secondaryButton: "#3B82F6",
    secondaryButtonColor: "#FFFFFF",
    secondaryButtonBorder: "#3B82F6",
    secondaryButtonFill: "#3B82F6",
    tertiaryButtonColor: "#1E3A8A",
    buttonBorder: "#BFDBFE",
    // Scripture text
    bookHeadingColor: "#1E3A8A",
    chapterHeadingColor: "#1E3A8A",
    verseNumberColor: "#2563EB",
    verseTextColor: "#1F2937",
    pageBackground: "#FFFFFF",
    pageTextColor: "#1F2937",
    // Side menu
    heading1Color: "#1E3A8A",
    heading2Color: "#1E3A8A",
    heading3Color: "#1E40AF",
    descriptionTextColor: "#6B7280",
    menuTextColor: "#1E3A8A",
    breadcrumbsColor: "#6B7280",
    sectionBackground: "#2563EB",
    spaceNameColor: "#1F2937",
    sideMenuIconsColor: "#374151",
    selectedSpaceColor: "#2563EB",
    unselectedSpaceColor: "#BFDBFE",
    spaceNameText: "#1F2937",
    addButtonBackground: "#2563EB",
    addButtonIcon: "#FFFFFF",
    selectPanelIcon: "#374151",
    openCloseMenuIcon: "#374151",
    moreIcon: "#6B7280",
    settingsIcon: "#6B7280",
    inactiveSpaceIndicator: "#D1D5DB",
    activeSpaceIndicator: "#2563EB",
    profileAvatar: "#F59E0B",
    // Selection UI & toolbar
    toolbarBorder: "#E5E7EB",
    toolbarFill: "#FFFFFF",
    toolbarIconsColor: "#374151",
    selectionUIBorder: "#E5E7EB",
    selectionUIFill: "#FFFFFF",
    selectionIconsColor: "#374151",
    toolbarBackground: "#FFFFFF",
    iconColor: "#374151",
    // Input fields
    inputTitleColor: "#1F2937",
    inputPlaceholderColor: "#9CA3AF",
    inputActiveBorder: "#2563EB",
    inputActiveFill: "#FFFFFF",
    inputInactiveBorder: "#D1D5DB",
    inputInactiveFill: "#FFFFFF",
    inputBackground: "#FFFFFF",
    inputBorder: "#D1D5DB",
    inputText: "#1F2937",
    inputPlaceholder: "#9CA3AF",
    // Branding
    logoColor: "#1E3A8A",
    accentColor: "#2563EB",
    // Space selection
    spaceSelection: "#DBEAFE",
    // Text colors
    text1: "#1F2937",
    text2: "#6B7280",
    showTabIcons: true,
    // Semantic colors
    primaryLight: "#DBEAFE",
    onPrimaryLight: "#1E40AF",
    primaryBase: "#2563EB",
    onPrimaryBase: "#FFFFFF",
    primaryDark: "#1E40AF",
    onPrimaryDark: "#FFFFFF",
    secondaryLight: "#EFF6FF",
    onSecondaryLight: "#1D4ED8",
    secondaryBase: "#3B82F6",
    onSecondaryBase: "#FFFFFF",
    secondaryDark: "#1D4ED8",
    onSecondaryDark: "#FFFFFF",
    tertiaryLight: "#BFDBFE",
    onTertiaryLight: "#1E3A8A",
    tertiaryBase: "#60A5FA",
    onTertiaryBase: "#1E3A8A",
    tertiaryDark: "#3B82F6",
    onTertiaryDark: "#FFFFFF",
    background: "#FFFFFF",
    onBackground: "#1F2937",
    surface: "#F9FAFB",
    onSurface: "#1F2937",
    text3: "#374151",
  };
  const defaultTheme = READY_THEMES[0]?.colors;
  const darkTheme = READY_THEMES[1]?.colors;
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  let theme =
    configBot.tags?.theme === "ligonier"
      ? LigonierTheme
      : isDark
        ? darkTheme
        : defaultTheme;

  const ThemeCSS = useMemo(() => {
    const colors = {
      ...theme, // start with defaults
      ...(themeColors?.[activeSpace] || {}), // overwrite with current themeColors
    };

    const vars = Object.entries(colors).map(
      ([key, value]) => `--${key}: ${value};`
    );

    // Get current space settings for fonts
    const currentSpace = spaces?.find((s) => s.id === activeSpace);
    const scriptureSettings = currentSpace?.scriptureSettings || {};
    const sideMenuSettings = currentSpace?.sideMenuSettings || {};
    const inputFieldsSettings = currentSpace?.inputFieldsSettings || {};

    // Helper to generate CSS variables from settings
    const generateFontVars = (
      settings: Record<string, unknown>,
      prefix: string,
      keyMap: Record<string, string>
    ) =>
      Object.entries(keyMap)
        .filter(([key]) => settings[key])
        .map(([key, cssName]) => {
          const value = settings[key];
          const isFont = key.toLowerCase().includes("font");
          return isFont
            ? `--${prefix}-${cssName}: '${value}', sans-serif;`
            : `--${prefix}-${cssName}: ${value}px;`;
        });

    const fontVars = [
      ...generateFontVars(scriptureSettings, "scripture", {
        bookHeadingFont: "bookHeading-font",
        bookHeadingSize: "bookHeading-size",
        chapterHeadingFont: "chapterHeading-font",
        chapterHeadingSize: "chapterHeading-size",
        verseTextFont: "verseText-font",
        verseTextSize: "verseText-size",
        verseNumberFont: "verseNumber-font",
        verseNumberSize: "verseNumber-size",
      }),
      ...generateFontVars(sideMenuSettings, "sideMenu", {
        spaceNameFont: "spaceName-font",
        spaceNameSize: "spaceName-size",
        menuTextFont: "menuText-font",
        menuTextSize: "menuText-size",
        heading1Font: "heading1-font",
        heading1Size: "heading1-size",
        heading2Font: "heading2-font",
        heading2Size: "heading2-size",
        heading3Font: "heading3-font",
        heading3Size: "heading3-size",
        descriptionTextFont: "description-font",
        descriptionTextSize: "description-size",
        breadcrumbsFont: "breadcrumbs-font",
        breadcrumbsSize: "breadcrumbs-size",
        iconsSize: "icons-size",
      }),
      ...generateFontVars(inputFieldsSettings, "input", {
        titleFont: "title-font",
        titleSize: "title-size",
        placeholderFont: "placeholder-font",
        placeholderSize: "placeholder-size",
      }),
    ];

    const allVars = [...vars, ...fontVars];
    // os.log(allVars, "all theme vars");
    return `:root {\n  ${allVars.join("\n  ")}\n}`;
  }, [themeColors, activeSpace, spaces]);
=======
  const ThemeCSS = useMemo(
    () =>
      calcThemeCSS(
        themeColors?.[activeSpace] ?? {},
        getActiveSpace(spaces, activeSpace)
      ),
    [themeColors, activeSpace, spaces]
  );
>>>>>>> sync/19-1-2026@7-41-14.98

  useEffect(() => {
    globalThis.ThemeCSS = ThemeCSS;
    return () => {
      globalThis.ThemeCSS = null;
    };
  }, [ThemeCSS]);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
      />
      <style>{ThemeCSS}</style>
      <MouseMoveProvider>
        <Layout panelsNumber={containerProps.apps.length}>
          <SplitApp {...containerProps} panalMode={false} />
        </Layout>
      </MouseMoveProvider>
    </>
  );
};

/**
 * Calculates whether or not the window width is of a "mobile" size.
 * @param mobileMaxWidth The maximum width to still be considered as mobile.
 * @param w The window object to reference innerWidth from.
 */
function calculateWindowIsMobile(
  mobileMaxWidth: number,
  w: Window = window
): boolean {
  return w.innerWidth <= mobileMaxWidth;
}

/**
 * We need to figure out what "Container" and "sidebar" are.
 * Nominal refactor needed.
 */
function refactorme_calculateContainerSize(
  isFullScreen: boolean,
  isMobile: boolean,
  sidebarWidth: number
) {
  const width: number =
    innerWidth - (!isFullScreen && !isMobile ? sidebarWidth : 0);
  const height: number = innerHeight * 0.98;
  return { width, height };
}

/**
 * This should probably be changed in the future.
 * Currently it serves to call hooks with their parameters.
 * It's used to centralize a resize effect for the main component.
 */
function callMainHooksOnResize(
  setIsMobileHook: (_: boolean) => any,
  isMobile: boolean,
  updateContainerSizeHook: (w: number, h: number) => any,
  width: number,
  height: number
) {
  setIsMobileHook(isMobile);
  setTimeout(() => updateContainerSizeHook(width, height), 0);
}

/**
 * A process designed to handle resize on main component.
 */
function handleResize(
  setIsMobileHook: (_: boolean) => any,
  updateContainerSizeHook: (w: number, height: number) => any,
  isFullScreen: boolean,
  sidebarWidth: number
) {
  const isMobile = calculateWindowIsMobile(767);
  const { width, height } = refactorme_calculateContainerSize(
    isFullScreen,
    isMobile,
    sidebarWidth
  );
  callMainHooksOnResize(
    setIsMobileHook,
    isMobile,
    updateContainerSizeHook,
    width,
    height
  );
}

function getActiveSpace(
  spaces: Array<{ id: string } & Record<string, any>>,
  activeSpaceId: string
) {
  return spaces?.find((s) => s.id === activeSpaceId) ?? null;
}
