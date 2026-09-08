import localFont from "next/font/local";

export const ibmPlexMono = localFont({
  variable: "--font-ibm-plex-mono",
  display: "swap",
  src: [
    { path: "../public/IBM_Plex_Mono/IBMPlexMono-Thin.ttf", weight: "100", style: "normal" },
    { path: "../public/IBM_Plex_Mono/IBMPlexMono-ThinItalic.ttf", weight: "100", style: "italic" },
    { path: "../public/IBM_Plex_Mono/IBMPlexMono-ExtraLight.ttf", weight: "200", style: "normal" },
    { path: "../public/IBM_Plex_Mono/IBMPlexMono-ExtraLightItalic.ttf", weight: "200", style: "italic" },
    { path: "../public/IBM_Plex_Mono/IBMPlexMono-Light.ttf", weight: "300", style: "normal" },
    { path: "../public/IBM_Plex_Mono/IBMPlexMono-LightItalic.ttf", weight: "300", style: "italic" },
    { path: "../public/IBM_Plex_Mono/IBMPlexMono-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/IBM_Plex_Mono/IBMPlexMono-Italic.ttf", weight: "400", style: "italic" },
    { path: "../public/IBM_Plex_Mono/IBMPlexMono-Medium.ttf", weight: "500", style: "normal" },
    { path: "../public/IBM_Plex_Mono/IBMPlexMono-MediumItalic.ttf", weight: "500", style: "italic" },
    { path: "../public/IBM_Plex_Mono/IBMPlexMono-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../public/IBM_Plex_Mono/IBMPlexMono-SemiBoldItalic.ttf", weight: "600", style: "italic" },
    { path: "../public/IBM_Plex_Mono/IBMPlexMono-Bold.ttf", weight: "700", style: "normal" },
    { path: "../public/IBM_Plex_Mono/IBMPlexMono-BoldItalic.ttf", weight: "700", style: "italic" },
  ],
});
