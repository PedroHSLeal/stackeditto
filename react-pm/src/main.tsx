import "@/main.scss";
// Resolvido para prosemirror-view-react (1.42.3) pelo modo react-pm do vite.config.ts.
import "prosemirror-view/style/prosemirror.css";
import "@/components/editors/prosemirror/prosemirror.scss";

import { createRoot } from "react-dom/client";

import { App } from "./App";
import { installKeyLatencyProbe } from "./metrics";

installKeyLatencyProbe((target) => target instanceof Element && !!target.closest(".ProseMirror"));

// Sem <StrictMode>: em dev ele monta cada editor duas vezes e distorceria a medida de montagem.
createRoot(document.getElementById("stackedit")!).render(<App />);
