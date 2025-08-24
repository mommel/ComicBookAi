
import math
import copy
import random
import shlex

import modules.scripts as scripts
import gradio as gr

from modules import sd_samplers, errors, sd_models
from modules.processing import Processed, process_images
from modules.shared import state


def process_model_tag(tag):
    info = sd_models.get_closet_checkpoint_match(tag)
    assert info is not None, f'Unknown checkpoint: {tag}'
    return info.name


def process_string_tag(tag):
    return tag


def process_int_tag(tag):
    return int(tag)


def process_float_tag(tag):
    return float(tag)


def process_boolean_tag(tag):
    return True if (tag == "true") else False


prompt_tags = {
    "sd_model": process_model_tag,
    "outpath_samples": process_string_tag,
    "outpath_grids": process_string_tag,
    "prompt_for_display": process_string_tag,
    "prompt": process_string_tag,
    "negative_prompt": process_string_tag,
    "styles": process_string_tag,
    "seed": process_int_tag,
    "subseed_strength": process_float_tag,
    "subseed": process_int_tag,
    "seed_resize_from_h": process_int_tag,
    "seed_resize_from_w": process_int_tag,
    "sampler_index": process_int_tag,
    "sampler_name": process_string_tag,
    "batch_size": process_int_tag,
    "n_iter": process_int_tag,
    "steps": process_int_tag,
    "cfg_scale": process_float_tag,
    "width": process_int_tag,
    "height": process_int_tag,
    "restore_faces": process_boolean_tag,
    "tiling": process_boolean_tag,
    "do_not_save_samples": process_boolean_tag,
    "do_not_save_grid": process_boolean_tag
}


def cmdargs(line):
    args = shlex.split(line)
    pos = 0
    res = {}

    while pos < len(args):
        arg = args[pos]

        assert arg.startswith("--"), f'must start with "--": {arg}'
        assert pos+1 < len(args), f'missing argument for command line option {arg}'

        tag = arg[2:]

        if tag == "prompt" or tag == "negative_prompt":
            pos += 1
            prompt = args[pos]
            pos += 1
            while pos < len(args) and not args[pos].startswith("--"):
                prompt += " "
                prompt += args[pos]
                pos += 1
            res[tag] = prompt
            continue


        func = prompt_tags.get(tag, None)
        assert func, f'unknown commandline option: {arg}'

        val = args[pos+1]
        if tag == "sampler_name":
            val = sd_samplers.samplers_map.get(val.lower(), None)

        res[tag] = func(val)

        pos += 2

    return res

def _ceil_to_16(x: float) -> int:
    return int(math.ceil(x / 16.0) * 16)

def load_prompt_file(file):
    if file is None:
        return None, gr.update(), gr.update(lines=7)
    else:
        lines = [x.strip() for x in file.decode('utf8', errors='ignore').split("\n")]
        return None, "\n".join(lines), gr.update(lines=7)


class Script(scripts.Script):
    def title(self):
        return "Comic Panels from file or textbox"

    def ui(self, is_img2img):
        checkbox_horizontal = gr.Checkbox(label="Create a horizontal Panel 7:5", value=False, elem_id=self.elem_id("checkbox_horizontal"))
        checkbox_vertical = gr.Checkbox(label="Create a vertical Panel 5:7", value=False, elem_id=self.elem_id("checkbox_vertical"))
        checkbox_square = gr.Checkbox(label="Create a square Panel 1:1", value=False, elem_id=self.elem_id("checkbox_square"))
        checkbox_narrow = gr.Checkbox(label="Create a narrow Panel 5:14", value=False, elem_id=self.elem_id("checkbox_narrow"))

        prompt_txt = gr.Textbox(label="List of prompt inputs", lines=1, elem_id=self.elem_id("prompt_txt"))
        file = gr.File(label="Upload prompt inputs", type='binary', elem_id=self.elem_id("file"))

        file.change(fn=load_prompt_file, inputs=[file], outputs=[file, prompt_txt, prompt_txt], show_progress=False)

        # We start at one line. When the text changes, we jump to seven lines, or two lines if no \n.
        # We don't shrink back to 1, because that causes the control to ignore [enter], and it may
        # be unclear to the user that shift-enter is needed.
        prompt_txt.change(lambda tb: gr.update(lines=7) if ("\n" in tb) else gr.update(lines=2), inputs=[prompt_txt], outputs=[prompt_txt], show_progress=False)
        return [checkbox_horizontal, checkbox_vertical, checkbox_square, checkbox_narrow, prompt_txt]

    def run(self, p, checkbox_horizontal, checkbox_vertical, checkbox_square, checkbox_narrow, prompt_txt: str):
        lines = [x for x in (x.strip() for x in prompt_txt.splitlines()) if x]

        p.do_not_save_grid = True

        job_count = 0
        jobs = []

        # Evaluate the bigger size
        basesize = max(int(p.width), int(p.height))

        # Set the new width for each paneltype
        new_width={
        'h': basesize,
        'v': _ceil_to_16(basesize * 5.0 / 7.0),
        's': basesize,
        'n': _ceil_to_16(basesize / 2),
        }
        
        # Set the new height for each paneltype
        new_height={
        'h': _ceil_to_16(basesize * 5.0 / 7.0),
        'v': basesize,
        's': basesize,
        'n': _ceil_to_16(basesize / 2 * 14.0 / 5),
        }
        

        for line in lines:
            if "--" in line:
                try:
                    args = cmdargs(line)
                except Exception:
                    errors.report(f"Error parsing line {line} as commandline", exc_info=True)
                    args = {"prompt": line}
            else:
                args = {"prompt": line}

                if checkbox_horizontal:
                    job_count += args.get("n_iter", p.n_iter)
                    args = {"prompt": line, "paneltype": "h" }          
                    jobs.append(args)

                if checkbox_vertical:
                    job_count += args.get("n_iter", p.n_iter)
                    args = {"prompt": line, "paneltype": "v" }
                    jobs.append(args)
                    
                if checkbox_square:
                    job_count += args.get("n_iter", p.n_iter)
                    args = {"prompt": line, "paneltype": "s" }
                    jobs.append(args)
                    
                if checkbox_narrow:
                    job_count += args.get("n_iter", p.n_iter)
                    args = {"prompt": line, "paneltype": "n" }
                    jobs.append(args)


        print(f"Will process {len(lines)} lines in {job_count} jobs.")

        state.job_count = job_count

        images = []
        all_prompts = []
        infotexts = []
        for args in jobs:
            state.job = f"{state.job_no + 1} out of {state.job_count}"

            copy_p = copy.copy(p)
            for k, v in args.items():
                if k == "sd_model":
                    copy_p.override_settings['sd_model_checkpoint'] = v
                else:
                    setattr(copy_p, k, v)

            try:
                paneltype = args.get("paneltype")
            except Exception:
                    errors.report(f"Error no paneltype active", exc_info=True)
                    return False

            copy_p.prompt = p.prompt + " " + args.get("prompt")
            copy_p.negative_prompt = p.negative_prompt
            copy_p.width = new_width.get(paneltype, 1024)
            copy_p.height = new_height.get(paneltype, 1024)
            copy_p.outpath_samples = p.outpath_samples + "_" + paneltype

            proc = process_images(copy_p)
            images += proc.images

            all_prompts += proc.all_prompts
            infotexts += proc.infotexts

        return Processed(p, images, p.seed, "", all_prompts=all_prompts, infotexts=infotexts)