import os

# Bypass SSL verification for HuggingFace Hub
os.environ["HF_HUB_DISABLE_SSL_VERIFY"] = "1"
os.environ["CURL_CA_BUNDLE"] = ""
os.environ["REQUESTS_CA_BUNDLE"] = ""

import torch
from diffusers import AudioLDM2Pipeline
import scipy.io.wavfile
import requests
import urllib3

# Dismantle SSL verification for broader safety
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
original_request = requests.Session.request
requests.Session.request = lambda self, method, url, **kwargs: original_request(
    self, method, url, verify=False, **kwargs
)


def generate_production_library():
    model_id = "cvssp/audioldm2-music"

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    torch_dtype = torch.float32

    print(f"🚀 Initializing Production Generation on {device}...")

    pipe = AudioLDM2Pipeline.from_pretrained(model_id, torch_dtype=torch_dtype)
    pipe.to(device)

    # Categories and their variation count
    # Updated Prompts for Variety and High Definition
    categories = {
        "ambient": {
            "prompt": "deep soft drone, meditative atmosphere, high fidelity, smooth texture, minimal, clean",
            "count": 8,
            "duration": 90,
        },
        "harmonic": {
            "prompt": "clear glass resonance, pure sine waves, evolving pads, airy atmosphere, beautiful, nítido",
            "count": 8,
            "duration": 90,
        },
        "rhythmic": {
            "prompt": "deep soft pulse, minimal rhythmic texture, warm bassline, hypnotic, clean production, cinematic",
            "count": 8,
            "duration": 90,
        },
        "glitch": {
            "prompt": "ethereal white noise, soft static pulses, grainy quantum decoherence, digital fading, mechanical whispers, silence background",
            "count": 8,
            "duration": 90,
        },
    }

    # Descriptors to ensure each of the 8 tracks is distinct
    descriptors = [
        "Ethereal and spacious",
        "Deep and heavy",
        "Shimmering and light",
        "Hollow and distant",
        "Warm and analog",
        "Crystal clear",
        "Dark and cinematic",
        "Bright and evolving",
    ]

    base_output_dir = os.path.join(os.getcwd(), "assets/audio/loops")
    os.makedirs(base_output_dir, exist_ok=True)

    total_tasks = sum(cat["count"] for cat in categories.values())
    current_task = 0

    for cat_name, config in categories.items():
        cat_dir = os.path.join(base_output_dir, cat_name)
        os.makedirs(cat_dir, exist_ok=True)

        for i in range(config["count"]):
            current_task += 1
            filename = f"track_{i + 1:02d}.wav"
            output_path = os.path.join(cat_dir, filename)

            if os.path.exists(output_path):
                print(
                    f"[{current_task}/{total_tasks}] Skipping {cat_name}/{filename} (exists)"
                )
                continue

            # Inject Unique Descriptor for Variety
            specific_vibe = descriptors[i % len(descriptors)]
            print(
                f"[{current_task}/{total_tasks}] Generating {cat_name} ({specific_vibe})..."
            )

            # Combine Vibe + Base Prompt
            final_prompt = f"{specific_vibe}, {config['prompt']}"

            # 200 steps for "Nítido" quality
            audio = pipe(
                final_prompt,
                num_inference_steps=200,
                audio_length_in_s=config["duration"],
            ).audios[0]

            # Save at 16k natively (upsampling happens in the browser engine)
            scipy.io.wavfile.write(output_path, 16000, audio)
            print(f"✅ Saved to {output_path}")


if __name__ == "__main__":
    generate_production_library()
