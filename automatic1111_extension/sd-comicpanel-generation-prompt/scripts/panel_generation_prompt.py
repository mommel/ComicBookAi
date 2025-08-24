
import os
import math
import copy
import gradio as gr
from typing import List, Tuple

from modules import scripts, processing, script_callbacks

# Globals for filename suffixing
_current_line_index = None
_current_panel_code = None  # "h" | "v" | "s" | "n"

def _ceil_to_16(x: float) -> int:
    return int(math.ceil(x / 16.0) * 16)

def _ensure_panels_folder(outpath_samples: str) -> str:
    # Given e.g. "outputs/txt2img-images" → return/create "outputs/text2img-panels"
    try:
        root = os.path.abspath(os.path.join(outpath_samples, os.pardir))
        target = os.path.join(root, "text2img-panels")
        os.makedirs(target, exist_ok=True)
        return target
    except Exception:
        return outpath_samples

def _on_before_image_saved(params: script_callbacks.ImageSaveParams):
    """Append -<lineIndex>-<panelCode> and redirect folder to outputs/text2img-panels."""
    global _current_line_index, _current_panel_code
    if _current_line_index is None or _current_panel_code is None:
        return
    base = params.filename
    params.filename = f"{base}-{_current_line_index}-{_current_panel_code}"
    # Redirect folder
    tgt = _ensure_panels_folder(params.p.outpath_samples)
    params.p.outpath_samples = tgt
    params.p.outpath_grids = tgt

# Register callback on import
script_callbacks.on_before_image_saved(_on_before_image_saved)

class Script(scripts.Script):
    def title(self):
        return "Panel Generation Prompt"

    def show(self, is_img2img):
        return scripts.AlwaysVisible

    def ui(self, is_img2img):
        with gr.Accordion("Panel Generation Prompt", open=False):
            enabled = gr.Checkbox(value=False, label="Enabled")

            prompts_box = gr.Textbox(
                label="List of prompt inputs",
                placeholder="One prompt per line",
                lines=8
            )
            file_input = gr.File(
                label="Upload prompt inputs",
                file_count="single",
                type="filepath"
            )

            with gr.Row():
                with gr.Group():
                    gr.Markdown("### Horizontal Panel")
                    chk_h = gr.Checkbox(value=True, label="Active")
                with gr.Group():
                    gr.Markdown("### Vertical Panel")
                    chk_v = gr.Checkbox(value=True, label="Active")
                with gr.Group():
                    gr.Markdown("### Square Panel")
                    chk_s = gr.Checkbox(value=True, label="Active")
                with gr.Group():
                    gr.Markdown("### Narrow Panel")
                    chk_n = gr.Checkbox(value=True, label="Active")

        # File upload → fill textbox
        def _load_prompts_from_file(path: str) -> str:
            if not path or not os.path.exists(path):
                return ""
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    return f.read()
            except Exception:
                return ""

        file_input.upload(fn=_load_prompts_from_file, inputs=file_input, outputs=prompts_box)

        # Return components in the same order expected by run()
        return [enabled, prompts_box, chk_h, chk_v, chk_s, chk_n]

    def run(self, p, enabled: bool, prompts_box: str, chk_h: bool, chk_v: bool, chk_s: bool, chk_n: bool):
        global _current_line_index, _current_panel_code

        if not enabled:
            # Pass-through if disabled
            return processing.process_images(p)

        lines = [ln.strip() for ln in (prompts_box or "").splitlines() if ln.strip()]
        if not lines:
            lines = [""]
        base = max(int(p.width), int(p.height))

        all_images = []
        infotexts = []

        for i, extra in enumerate(lines, start=1):
            # Merge: positive prompt first, then the line
            merged_prompt = f"{p.prompt or ''} {extra}".strip()

            jobs = []
            if chk_h:
                w = base
                h = _ceil_to_16(base * 5.0 / 7.0)
                jobs.append(("h", w, h))
            if chk_v:
                h = base
                w = _ceil_to_16(base * 5.0 / 7.0)
                jobs.append(("v", w, h))
            if chk_s:
                w = base
                h = base
                jobs.append(("s", w, h))
            if chk_n:
                w = base
                h = _ceil_to_16(base * 5.0 / 14.0)
                jobs.append(("n", w, h))

            for code, w, h in jobs:
                p2 = copy.copy(p)
                p2.width = int(w)
                p2.height = int(h)
                p2.prompt = merged_prompt

                _current_line_index = i
                _current_panel_code = code

                proc = processing.process_images(p2)
                all_images.extend(proc.images)
                infotexts.extend(proc.infotexts)

        _current_line_index = None
        _current_panel_code = None

        return processing.Processed(p, all_images, p.seed, infotexts=infotexts)
