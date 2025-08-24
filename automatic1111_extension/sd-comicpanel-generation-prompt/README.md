Comic Panel Generation Script Extension for stable-diffusion-webui

The extension appears in the scripts dropdown, provides 4 checkbox options, a promptbox and and prompt file upload.

## Comicpanel creation

The Basesize for all panels will be the bigger value of width and height. The calculated values always get rounded to the nearest of 16.

For all creation the same seed will be used. The prompt will be combined,so that the general prompt gets used and the line prompts will be added at the end. For each line every active panel option gets created.

You might ask why so strict? To get a persistent quality and look and feel that the images belong together. We can archive that by using a Prompt that describes the context and the additional Prompt will describe the content of the image.

### The horizontal Panel

This option creates an Image at a ratio of __7:5__ . It's width will be the basesize, it's height will be it's match for that value.
The image will be created at __txt2img-images_h__

### The vertical Panel

This option creates an Image at a ratio of __5:7__ . It's height will be the basesize, it's width will be it's match for that value.
The image will be created at __txt2img-images_v__

### The square Panel

This option creates an Image at a ratio of __1:1__ . It's height and width will be the basesize
The image will be created at __txt2img-images_s__

### The narrow Panel

This option creates an Image at a ratio of __5:14__ . It's width will be the half basesize, it's heigt will be it's match for that value.
The image will be created at __txt2img-images_n__


## Install

1. Clone repo and move the extension into stable-diffusion-webui/extensions folder.


## How to use

* Select "Comic Panels from file or textbox" in the scripts dropdown.
* Activate the panels you want to create
* Add prompts line by line into the textbox or use the upload function


## Example use

### Prompt 
```
gridless  single frame  black-and-white ink comic panel , high-contrast, dark aesthetic, heavy setting; no speech bubbles, no on-image text, clean creation,  cinematic lighting,  professional  composition; no watermark, no signing; typical 60s us comic style;
```

### Line Prompts
``` 
background falls away to charcoal tone; 50mm portrait framing. ( consistent character man with rubbish shirt and beard ) looking around;
A woman stumbles over a cat;
( consistent character man with a rubbish shirt and beard ) supports the woman a steady hand on the shoulder;
```