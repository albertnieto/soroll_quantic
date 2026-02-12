import torch
from diffusers import AudioLDM2Pipeline
import scipy.io.wavfile
import os


def generate_loops():
    model_id = "cvssp/audioldm2-music"

    # Determine device: MPS for Mac is ideal, otherwise CPU
    if torch.backends.mps.is_available():
        device = "mps"
        torch_dtype = torch.float32
    elif torch.cuda.is_available():
        device = "cuda"
        torch_dtype = torch.float16
    else:
        device = "cpu"
        torch_dtype = torch.float32

    print(f"Using device: {device}")

    pipe = AudioLDM2Pipeline.from_pretrained(model_id, torch_dtype=torch_dtype)
    pipe.to(device)

    # Prompts for different "Quantum Moods" organized by category
    prompts = [
        {
            "category": "ambient",
            "name": "quantum_void",
            "text": "Deep sub-harmonic resonance, dark void, ethereal space ambience, minimal texture, 432Hz tuning, high fidelity",
            "duration": 15,
        },
        {
            "category": "harmonic",
            "name": "glass_superposition",
            "text": "Crystalline shimmering textures, glass harmonic resonances, delicate quantum fluctuations, ethereal, high frequency detail",
            "duration": 15,
        },
        {
            "category": "rhythmic",
            "name": "entangled_pulse",
            "text": "Slow rhythmic rhythmic low-frequency pulses, magnetic resonance, thick atmosphere, organic flowing energy",
            "duration": 15,
        },
        {
            "category": "glitch",
            "name": "decoherence_noise",
            "text": "Ethereal white noise, soft static, grainy textures, quantum decoherence, fading memories, atmospheric",
            "duration": 15,
        },
    ]

    base_output_dir = os.path.join(os.getcwd(), "assets/audio/loops")
    os.makedirs(base_output_dir, exist_ok=True)

    for prompt in prompts:
        category_dir = os.path.join(base_output_dir, prompt["category"])
        os.makedirs(category_dir, exist_ok=True)

        output_path = os.path.join(category_dir, f"{prompt['name']}.wav")
        if os.path.exists(output_path):
            print(f"Skipping {prompt['name']}, already exists in {prompt['category']}.")
            continue

        print(f"Generating [{prompt['category']}]: {prompt['name']}...")
        audio = pipe(
            prompt["text"], num_inference_steps=50, audio_length_in_s=prompt["duration"]
        ).audios[0]

        # Save as WAV
        scipy.io.wavfile.write(output_path, 16000, audio)
        print(f"Saved to {output_path}")


if __name__ == "__main__":
    generate_loops()
