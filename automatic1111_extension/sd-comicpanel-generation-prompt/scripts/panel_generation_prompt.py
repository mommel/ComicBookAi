
import os
import math
import copy
import gradio as gr
from typing import List, Tuple

from modules import scripts, processing, script_callbacks
from modules.shared import state

# Globals for filename suffixing
_pending_suffixes: List[Tuple[int, str]] = []  # (line index, panel code)
_callback_registered = False

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
    if not _pending_suffixes:
        return
    line_idx, code = _pending_suffixes.pop(0)
    base = params.filename
    params.filename = f"{base}-{line_idx}-{code}"
    # Redirect folder
    tgt = _ensure_panels_folder(params.p.outpath_samples)
    params.p.outpath_samples = tgt
    params.p.outpath_grids = tgt

# Register callback on import once
if not _callback_registered:
    script_callbacks.on_before_image_saved(_on_before_image_saved)
    _callback_registered = True

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
        if not enabled:
            # Pass-through if disabled
            return processing.process_images(p)

        processing.fix_seed(p)

        lines = [ln.strip() for ln in (prompts_box or "").splitlines() if ln.strip()]
        if not lines:
            lines = [""]
        base = max(int(p.width), int(p.height))

        panel_jobs = []
        if chk_h:
            panel_jobs.append(("h", base, _ceil_to_16(base * 5.0 / 7.0)))
        if chk_v:
            panel_jobs.append(("v", _ceil_to_16(base * 5.0 / 7.0), base))
        if chk_s:
            panel_jobs.append(("s", base, base))
        if chk_n:
            panel_jobs.append(("n", base, _ceil_to_16(base * 5.0 / 14.0)))

        total_jobs = len(lines) * len(panel_jobs)
        state.job_count = total_jobs

        _pending_suffixes.clear()

        all_images: List[object] = []
        all_prompts: List[str] = []
        all_seeds: List[int] = []
        infotexts: List[str] = []

        seed_offset = 0

        for code, w, h in panel_jobs:
            p2 = copy.copy(p)
            p2.width = int(w)
            p2.height = int(h)
            prompts = [f"{p.prompt or ''} {extra}".strip() for extra in lines]
            seeds = [p.seed + seed_offset + i for i in range(len(prompts))]
            p2.prompt = prompts
            p2.seed = seeds
            p2.n_iter = math.ceil(len(prompts) / p.batch_size)
            p2.do_not_save_grid = True
            p2.do_not_show_grid = True

            _pending_suffixes.extend((i + 1, code) for i in range(len(prompts)))
            try:
                proc = processing.process_images(p2)
            finally:
                _pending_suffixes.clear()

            all_images.extend(proc.images)
            all_prompts.extend(proc.all_prompts or prompts)
            all_seeds.extend(proc.all_seeds or seeds)
            infotexts.extend(proc.infotexts)

            seed_offset += len(prompts)

        seed = all_seeds[0] if all_seeds else p.seed
        return processing.Processed(
            p,
            all_images,
            seed,
            all_seeds=all_seeds,
            all_prompts=all_prompts,
            infotexts=infotexts,
        )
